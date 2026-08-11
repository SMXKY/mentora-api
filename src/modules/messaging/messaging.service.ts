import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  ConversationType,
  ConversationStatus,
  MessageStatus,
  MessageFilterResult,
  ModerationReviewTrigger,
  ModerationReviewStatus,
  NotificationType,
  NotificationResourceType,
  FileCategory,
  FileType,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { NotificationService } from "../../services/notification/notification.service";
import { emitToConversation, emitToUser, isUserOnline } from "../../socket/index";
import { filterMessage } from "../../services/messaging/contentFilter";
import { messagingConfig } from "../../services/messaging/messagingConfig";
import { resolveStorageUrl } from "../../services/media";
import { encodeForLegacyDb, decodeFromLegacyDb } from "../../utils/legacyTextEncoding.util";
import { UserService } from "../user/user.service";
import { ReportCategory } from "./messaging.types";
import { BookingAccessService } from "../../services/booking/bookingAccess.service";

const userService = new UserService();

const DISPLAY_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePictureUrl: true,
  lastActiveAt: true,
  tutorProfile: { select: { id: true } },
};

type DisplayUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  lastActiveAt: Date | null;
  tutorProfile: { id: string } | null;
};

/** Flattens the tutorProfile relation into a tutorProfileId the client can
 * link straight to the public tutor profile route — null for non-tutors.
 * lastActiveAt is included everywhere this runs (cheap, always selected);
 * isOnline is deliberately NOT computed here — it needs a live socket-room
 * check (isUserOnline), which is only worth paying for the single
 * conversation a viewer is actually looking at (getConversationSummaryForUser),
 * not for every row in a conversation list. */
function toDisplayParticipant(user: DisplayUser) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePictureUrl: user.profilePictureUrl,
    tutorProfileId: user.tutorProfile?.id ?? null,
    lastActiveAt: user.lastActiveAt,
  };
}

const OPEN_MODERATION_STATUSES: ModerationReviewStatus[] = [
  ModerationReviewStatus.PENDING,
  ModerationReviewStatus.REVIEWED,
  ModerationReviewStatus.WARNING_ISSUED,
  ModerationReviewStatus.FROZEN,
  ModerationReviewStatus.ESCALATED,
];

/** One conversation ever exists between a given pair of users — this finds it regardless of status/type. */
async function findConversationForPair(userIdA: string, userIdB: string) {
  const candidates = await prisma.conversation.findMany({
    where: {
      deletedAt: null,
      participants: { some: { userId: userIdA, removedAt: null } },
    },
    include: { participants: { where: { removedAt: null } } },
  });
  return (
    candidates.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.userId === userIdB)
    ) ?? null
  );
}

async function startConversation(
  initiatorUserId: string,
  tutorProfileId: string,
  ctx: ServiceContext
) {
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: { userId: true },
  });
  if (!tutorProfile)
    throw new AppError("messaging/errors:tutorNotFound", StatusCodes.NOT_FOUND);
  const tutorUserId = tutorProfile.userId;

  if (initiatorUserId === tutorUserId) {
    throw new AppError(
      "messaging/errors:cannotMessageSelf",
      StatusCodes.BAD_REQUEST
    );
  }

  // Tutor cannot initiate a new conversation — only Parent/Student can.
  const initiatorIsTutor = await prisma.tutorProfile.findUnique({
    where: { userId: initiatorUserId },
    select: { id: true },
  });
  if (initiatorIsTutor) {
    throw new AppError(
      "messaging/errors:tutorCannotInitiate",
      StatusCodes.FORBIDDEN
    );
  }

  const existing = await findConversationForPair(initiatorUserId, tutorUserId);
  if (existing) return existing;

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        type: ConversationType.INQUIRY,
        status: ConversationStatus.ACTIVE,
      },
    });
    await tx.conversationParticipant.createMany({
      data: [
        {
          conversationId: created.id,
          userId: initiatorUserId,
          addedById: initiatorUserId,
        },
        {
          conversationId: created.id,
          userId: tutorUserId,
          addedById: initiatorUserId,
        },
      ],
    });
    return created;
  });

  AuditService.record(ctx, "conversations", {
    operation: "CREATE" as any,
    category: "WRITE" as any,
    recordId: conversation.id,
    newState: conversation,
    eventType: "conversation_started",
  });

  return conversation;
}

/** REQ — booking confirmed+paid upgrades the pair's one-and-only conversation to Active, creating it if it never existed. */
async function upgradeToActiveForBooking(
  bookingId: string,
  tutorUserId: string,
  parentUserId: string
) {
  const existing = await findConversationForPair(parentUserId, tutorUserId);

  if (existing) {
    return prisma.conversation.update({
      where: { id: existing.id },
      data: {
        type: ConversationType.DIRECT,
        status: ConversationStatus.ACTIVE,
        bookingId,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        status: ConversationStatus.ACTIVE,
        bookingId,
      },
    });
    await tx.conversationParticipant.createMany({
      data: [
        { conversationId: created.id, userId: parentUserId },
        { conversationId: created.id, userId: tutorUserId },
      ],
    });
    return created;
  });
}

/** REQ — booking completed/cancelled/resolved-dispute archives the conversation
 * (moves it to the inbox's "archived" tab) and stamps quotaResetAt so the
 * pair's next message starts a fresh 10-message quota cycle instead of being
 * evaluated against every message ever sent during the (now-ended) booking. */
async function archiveForBooking(bookingId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { bookingId },
  });
  if (!conversation) return null;
  if (conversation.status === ConversationStatus.ARCHIVED) return conversation;
  return prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: ConversationStatus.ARCHIVED, quotaResetAt: new Date() },
  });
}

async function loadConversationForParticipant(
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { where: { removedAt: null } } },
  });
  if (!conversation)
    throw new AppError(
      "messaging/errors:conversationNotFound",
      StatusCodes.NOT_FOUND
    );
  const participant = conversation.participants.find(
    (p) => p.userId === userId
  );
  if (!participant)
    throw new AppError(
      "messaging/errors:notYourConversation",
      StatusCodes.FORBIDDEN
    );
  return { conversation, participant };
}

const MESSAGING_PATTERN_SIGNAL = "MESSAGING_FILTER_PATTERN";

/** REQ-015 — 5+ blocked attempts across any of a user's conversations within 24h flags them in Trust & Safety. */
async function flagUserForTrustSafety(userId: string, blockId: string) {
  let riskScore = await prisma.riskScore.findUnique({ where: { userId } });
  if (!riskScore)
    riskScore = await prisma.riskScore.create({ data: { userId } });

  await prisma.riskSignal.create({
    data: {
      userId,
      riskScoreId: riskScore.id,
      signalType: MESSAGING_PATTERN_SIGNAL,
      pointsApplied: 0,
      scoreBefore: riskScore.currentScore,
      scoreAfter: riskScore.currentScore,
      stateBefore: riskScore.currentState,
      stateAfter: riskScore.currentState,
      sourceModule: "MESSAGING",
      sourceRecordId: blockId,
      sourceRecordType: "FilterBlock",
    },
  });

  if (!riskScore.humanReviewDueAt) {
    await prisma.riskScore.update({
      where: { id: riskScore.id },
      data: { humanReviewDueAt: new Date() },
    });
  }
}

async function handleBlockedMessage(
  conversationId: string,
  senderId: string,
  attemptedContent: string,
  outcome: {
    result: MessageFilterResult;
    layer: 1 | 2 | 3 | null;
    matchedPattern: string | null;
    normalisedContent: string | null;
  },
  conversationBlockCount: number
) {
  const { blockEscalationThreshold, patternFlagThreshold } =
    await messagingConfig.getAll();

  const block = await prisma.filterBlock.create({
    data: {
      conversationId,
      senderId,
      attemptedContent: encodeForLegacyDb(attemptedContent),
      filterResult: outcome.result,
      matchedPattern: outcome.matchedPattern,
      normalisedContent:
        outcome.normalisedContent != null
          ? encodeForLegacyDb(outcome.normalisedContent)
          : null,
      filterLayer: outcome.layer ?? 1,
    },
  });

  const newBlockCount = conversationBlockCount + 1;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { blockCountConversation: newBlockCount },
  });

  let escalatedToModerator = false;
  if (newBlockCount >= blockEscalationThreshold) {
    const alreadyOpen = await prisma.moderationReview.findFirst({
      where: {
        conversationId,
        trigger: ModerationReviewTrigger.FILTER_ESCALATION,
        status: { in: OPEN_MODERATION_STATUSES },
      },
    });
    if (!alreadyOpen) {
      await prisma.moderationReview.create({
        data: {
          conversationId,
          trigger: ModerationReviewTrigger.FILTER_ESCALATION,
          filterBlockId: block.id,
        },
      });
      escalatedToModerator = true;
    }
  }

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentBlockCount = await prisma.filterBlock.count({
    where: { senderId, createdAt: { gte: windowStart } },
  });
  let escalatedToTrustSafety = false;
  if (recentBlockCount >= patternFlagThreshold) {
    escalatedToTrustSafety = true;
    await flagUserForTrustSafety(senderId, block.id);
  }

  if (escalatedToModerator || escalatedToTrustSafety) {
    await prisma.filterBlock.update({
      where: { id: block.id },
      data: { escalatedToModerator, escalatedToTrustSafety },
    });
  }
}

// Catches contact info deliberately split across several short messages
// (e.g. "671" then "234" then "567") — none of which are individually
// phone-shaped enough to trip the single-message filter above. Pulls this
// sender's own recent messages in this conversation and glues them to the
// message being sent right now, so the same filterMessage() re-run over
// the combined text reunites adjacent fragments (Layer 2's
// separator-stripping merges them back into one digit run). Only this
// sender's own messages are pulled in — mixing in the other participant's
// text risks gluing two people's unrelated digit mentions together.
async function buildRecentSenderWindowText(
  conversationId: string,
  senderId: string,
  currentContent: string
): Promise<string> {
  const { contactFilterWindowMessages, contactFilterWindowSeconds } =
    await messagingConfig.getAll();
  const windowStart = new Date(
    Date.now() - contactFilterWindowSeconds * 1000
  );
  const priorMessages = await prisma.message.findMany({
    where: {
      conversationId,
      senderId,
      contentDeleted: false,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(contactFilterWindowMessages - 1, 0),
    select: { content: true },
  });
  const priorTexts = priorMessages
    .reverse()
    .map((m) => decodeFromLegacyDb(m.content))
    .filter(Boolean);
  return [...priorTexts, currentContent].join(" ");
}

type ReplyToPreview = {
  id: string;
  senderId: string;
  content: string;
  contentDeleted: boolean;
  attachment?: AttachmentPreview;
} | null;

function serializeReplyTo(replyTo: ReplyToPreview) {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    senderId: replyTo.senderId,
    content: replyTo.contentDeleted ? null : decodeFromLegacyDb(replyTo.content),
    contentDeleted: replyTo.contentDeleted,
    // So the reply preview (composer bar + in-bubble quote) can show a
    // thumbnail/filename instead of going blank when the quoted message
    // was media with no caption.
    attachment: replyTo.contentDeleted ? null : serializeAttachment(replyTo.attachment ?? null),
  };
}

type AttachmentPreview = {
  id: string;
  storagePath: string;
  fileType: FileType;
  mimeType: string;
  originalFileName: string;
  fileSizeBytes: bigint;
} | null;

function serializeAttachment(attachment: AttachmentPreview) {
  if (!attachment) return null;
  return {
    id: attachment.id,
    url: resolveStorageUrl(attachment.storagePath),
    fileType: attachment.fileType,
    mimeType: attachment.mimeType,
    originalFileName: attachment.originalFileName,
    fileSizeBytes: attachment.fileSizeBytes,
  };
}

// Emoji-only so the conversation-list preview for a caption-less attachment
// doesn't hardcode an English (or any single-language) word into a bilingual
// product's stored data — the emoji itself is the language-neutral summary.
function attachmentPreviewLabel(attachment: AttachmentPreview): string {
  switch (attachment?.fileType) {
    case FileType.IMAGE:
      return "📷";
    case FileType.AUDIO:
      return "🎵";
    case FileType.VIDEO:
      return "🎥";
    default:
      return "📄";
  }
}

function serializeMessage(message: {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  contentDeleted: boolean;
  status: MessageStatus;
  replyToId: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  replyTo?: ReplyToPreview;
  attachment?: AttachmentPreview;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    // Empty string (an attachment sent with no caption) collapses to null,
    // same contract as a deleted message — the client only ever sees a real
    // caption or nothing, never an empty string it has to check for itself.
    content: message.contentDeleted ? null : decodeFromLegacyDb(message.content) || null,
    contentDeleted: message.contentDeleted,
    status: message.status,
    replyToId: message.replyToId,
    createdAt: message.createdAt,
    deliveredAt: message.deliveredAt,
    replyTo: serializeReplyTo(message.replyTo ?? null),
    attachment: message.contentDeleted ? null : serializeAttachment(message.attachment ?? null),
  };
}

async function sendMessage(
  senderId: string,
  conversationId: string,
  content: string | undefined,
  ctx: ServiceContext,
  replyToId?: string,
  attachmentFileId?: string
) {
  const { conversation } = await loadConversationForParticipant(
    conversationId,
    senderId
  );

  if (conversation.status === ConversationStatus.FROZEN) {
    throw new AppError(
      "messaging/errors:conversationFrozen",
      StatusCodes.FORBIDDEN
    );
  }
  // ARCHIVED (set by archiveForBooking when a booking ends) is deliberately
  // NOT a hard block here — it now only means "not in the active inbox tab".
  // A pair whose booking has lapsed can still message under the same
  // no-booking-access quota as a pair that's never booked (see the
  // hasBookingAccess check below), rather than being locked out entirely.

  // Chat-only block enforcement — checked on every send (not just at
  // conversation-open time) so a block taken mid-conversation takes effect
  // immediately in both directions, socket or REST.
  //
  // The two directions are handled very differently on purpose:
  //  - Sender blocked the recipient (blockedByA): a loud, immediate error —
  //    the sender already knows about their own block, nothing to hide.
  //  - Recipient blocked the sender (blockedByB): WhatsApp-style silent
  //    block. The send proceeds through every normal step below (content
  //    validation, filter, persistence) and reports success to the sender
  //    exactly like any other message — but the created row is flagged
  //    hiddenFromRecipient and never reaches the recipient in any form
  //    (no realtime event, no notification, no unread bump, no listMessages
  //    visibility). Revealing the block to the sender via an error would
  //    let them confirm they'd been blocked, which is exactly what this
  //    behavior exists to prevent.
  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== senderId
  );
  let hiddenFromRecipient = false;
  if (otherParticipant) {
    const { blockedByA, blockedByB } = await userService.getBlockStatus(
      senderId,
      otherParticipant.userId
    );
    if (blockedByA) {
      throw new AppError(
        "messaging/errors:youBlockedRecipient",
        StatusCodes.FORBIDDEN
      );
    }
    hiddenFromRecipient = blockedByB;
  }

  // Shared by both the attachment gate and the message-quota gate below —
  // one live booking query per send, not two.
  const hasBookingAccess = otherParticipant
    ? await BookingAccessService.hasActiveOrUpcomingBookingAccess(
        senderId,
        otherParticipant.userId
      )
    : false;

  const trimmed = (content ?? "").trim();
  // An attachment can carry no caption at all (WhatsApp-style) — only
  // reject empty when there's also no attachment to send.
  if (!trimmed && !attachmentFileId)
    throw new AppError(
      "messaging/errors:messageEmpty",
      StatusCodes.BAD_REQUEST
    );
  if (trimmed.length > 2000)
    throw new AppError(
      "messaging/errors:messageTooLong",
      StatusCodes.BAD_REQUEST
    );

  // Must belong to this sender and be an actual message-attachment upload —
  // never trust a client-supplied file id blind, or a message could point
  // at someone else's private file (KYC docs, receipts, etc.) via category.
  let attachment: AttachmentPreview = null;
  if (attachmentFileId) {
    if (!hasBookingAccess) {
      throw new AppError(
        "messaging/errors:attachmentRequiresBooking",
        StatusCodes.FORBIDDEN
      );
    }
    attachment = await prisma.file.findFirst({
      where: {
        id: attachmentFileId,
        uploadedById: senderId,
        fileCategory: FileCategory.MESSAGE_ATTACHMENT,
        deletedAt: null,
      },
      select: {
        id: true,
        storagePath: true,
        fileType: true,
        mimeType: true,
        originalFileName: true,
        fileSizeBytes: true,
      },
    });
    if (!attachment) {
      throw new AppError(
        "messaging/errors:attachmentNotFound",
        StatusCodes.BAD_REQUEST
      );
    }
  }

  // Must belong to this same conversation — never trust a client-supplied
  // message id blind, or a reply could quote content from a conversation
  // this sender isn't even a participant of.
  let replyTo: ReplyToPreview = null;
  if (replyToId) {
    replyTo = await prisma.message.findFirst({
      where: { id: replyToId, conversationId, deletedAt: null },
      select: {
        id: true,
        senderId: true,
        content: true,
        contentDeleted: true,
        attachment: {
          select: {
            id: true,
            storagePath: true,
            fileType: true,
            mimeType: true,
            originalFileName: true,
            fileSizeBytes: true,
          },
        },
      },
    });
    if (!replyTo) {
      throw new AppError(
        "messaging/errors:replyToNotFound",
        StatusCodes.BAD_REQUEST
      );
    }
  }

  if (!hasBookingAccess) {
    const { inquiryMessageLimit } = await messagingConfig.getAll();

    // windowStart marks where the CURRENT free-tier quota cycle started
    // counting from — quotaResetAt is stamped to "now" every time this
    // pair's booking access lapses (archiveForBooking), so a pair who
    // exchanged hundreds of messages during a past active booking isn't
    // stuck at 0 forever afterward; each cycle gets a fresh 10.
    let windowStart = conversation.quotaResetAt ?? conversation.createdAt;

    // Self-heal: a conversation that was upgraded to DIRECT by a past
    // booking (type stays DIRECT permanently once set) but never went
    // through archiveForBooking yet — e.g. a PAID booking whose session
    // time passed with no check-in, and therefore no status-transition
    // cron ever ran — has quotaResetAt still null even though access has
    // in fact lapsed (hasBookingAccess is false, or we wouldn't be here).
    // Stamp the reset point now, the first time this is observed. This one
    // message is still evaluated against the old unbounded count below (so
    // it always goes through), but every message after it is correctly
    // bounded — a one-time, one-message leak per lapse, not a recurring one.
    if (!conversation.quotaResetAt && conversation.type === ConversationType.DIRECT) {
      const stamped = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { quotaResetAt: new Date() },
        select: { quotaResetAt: true },
      });
      windowStart = stamped.quotaResetAt!;
    }

    const messageCount = await prisma.message.count({
      where: {
        conversationId,
        contentDeleted: false,
        createdAt: { gte: windowStart },
      },
    });
    if (messageCount >= inquiryMessageLimit) {
      throw new AppError(
        "messaging/errors:inquiryLimitReached",
        StatusCodes.FORBIDDEN,
        { limit: inquiryMessageLimit }
      );
    }
  }

  // Only worth running the contact-info/profanity filter when there's
  // actual text — an attachment isn't scanned (no OCR), and an
  // attachment-only send has nothing for the filter to evaluate.
  if (trimmed) {
    const activeKeywordRows = await prisma.filterKeyword.findMany({
      where: { isActive: true },
      select: { keyword: true },
    });
    const activeKeywords = activeKeywordRows.map((k) => k.keyword);

    let outcome = filterMessage(trimmed, activeKeywords);

    if (outcome.result === "CLEAN") {
      // Clean on its own — check whether it completes a phone/contact
      // fragment split across this sender's recent messages.
      const windowText = await buildRecentSenderWindowText(
        conversationId,
        senderId,
        trimmed
      );
      if (windowText !== trimmed) {
        const windowOutcome = filterMessage(windowText, activeKeywords);
        if (windowOutcome.result !== "CLEAN") {
          outcome = {
            ...windowOutcome,
            matchedPattern: windowOutcome.matchedPattern
              ? `window:${windowOutcome.matchedPattern}`
              : windowOutcome.matchedPattern,
            normalisedContent: windowText,
          };
        }
      }
    }

    if (outcome.result !== "CLEAN") {
      await handleBlockedMessage(
        conversationId,
        senderId,
        trimmed,
        outcome,
        conversation.blockCountConversation
      );
      throw new AppError(
        "messaging/errors:messageBlocked",
        StatusCodes.BAD_REQUEST,
        { result: outcome.result }
      );
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: trimmed ? encodeForLegacyDb(trimmed) : "",
        status: MessageStatus.SENT,
        replyToId: replyTo?.id,
        attachmentFileId: attachment?.id,
        hiddenFromRecipient,
      },
    });
    // A hidden message must never surface anywhere the recipient can see it
    // — including the conversation list preview, which is shared by both
    // participants (there's no per-participant preview field). Skipping
    // this update means the sender's own conversation-list row also won't
    // reflect the new message until a later, non-hidden message updates it
    // — an accepted, low-visibility trade-off against the alternative of
    // leaking the send to the blocking recipient's list.
    if (!hiddenFromRecipient) {
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: created.createdAt,
          lastMessagePreview: encodeForLegacyDb(
            trimmed ? trimmed.slice(0, 100) : attachmentPreviewLabel(attachment)
          ),
        },
      });
      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId: { not: senderId }, removedAt: null },
        data: { unreadCount: { increment: 1 } },
      });
    }
    return created;
  });

  const recipients = conversation.participants.filter(
    (p) => p.userId !== senderId
  );

  // Delivery-status tracking is meaningless for a message the recipient
  // will never receive — skip the online check and leave it SENT, which is
  // also exactly the status the sender is supposed to see either way.
  let finalMessage = message;
  if (!hiddenFromRecipient) {
    const onlineFlags = await Promise.all(
      recipients.map((r) => isUserOnline(r.userId))
    );
    const anyRecipientOnline = onlineFlags.some(Boolean);
    finalMessage = anyRecipientOnline
      ? await prisma.message.update({
          where: { id: message.id },
          data: { status: MessageStatus.DELIVERED, deliveredAt: new Date() },
        })
      : message;
  }

  const serialized = serializeMessage({ ...finalMessage, replyTo, attachment });

  if (hiddenFromRecipient) {
    // Only the sender's own other sessions/devices get the realtime echo —
    // never the conversation room, which the blocking recipient is also in.
    emitToUser(senderId, "message:new", serialized);
    return serialized;
  }

  emitToConversation(conversationId, "message:new", serialized);

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { firstName: true, lastName: true },
  });
  const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : "";

  await Promise.all(
    recipients.map((r) =>
      NotificationService.send({
        type: NotificationType.NEW_MESSAGE_RECEIVED,
        target: { kind: "user", userId: r.userId },
        resourceType: NotificationResourceType.MESSAGE,
        resourceId: finalMessage.id,
        data: { senderName },
      })
    )
  );

  return serialized;
}

async function getConversationSummaryForUser(
  conversationId: string,
  userId: string
) {
  const { conversation } = await loadConversationForParticipant(
    conversationId,
    userId
  );

  const other = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: { not: userId }, removedAt: null },
    include: { user: { select: DISPLAY_USER_SELECT } },
  });

  if (other && other.user && other.user.profilePictureUrl)
    other.user.profilePictureUrl = resolveStorageUrl(
      other?.user.profilePictureUrl
    );

  // mediaAllowed and messagesRemaining both key off the same live
  // active-or-upcoming-booking check as sendMessage — type-agnostic (no
  // longer INQUIRY-only), so a pair whose booking has lapsed sees the
  // capped state again here too, not just on the next failed send.
  let messagesRemaining: number | null = null;
  let mediaAllowed = true;
  if (other?.user) {
    const hasAccess = await BookingAccessService.hasActiveOrUpcomingBookingAccess(
      userId,
      other.user.id
    );
    mediaAllowed = hasAccess;
    if (!hasAccess) {
      const { inquiryMessageLimit } = await messagingConfig.getAll();
      // Read-only here — no quotaResetAt stamping side effect on a summary
      // fetch; the stamp (and any self-heal) happens on the next actual
      // sendMessage. This can show a slightly stale/lifetime-since-creation
      // count for a conversation that's only ever been viewed, never sent
      // to, right after a lapse — cosmetic only, self-corrects on first send.
      const windowStart = conversation.quotaResetAt ?? conversation.createdAt;
      const messageCount = await prisma.message.count({
        where: {
          conversationId,
          contentDeleted: false,
          createdAt: { gte: windowStart },
        },
      });
      messagesRemaining = Math.max(inquiryMessageLimit - messageCount, 0);
    }
  } else {
    mediaAllowed = false;
  }

  // Both are cheap enough to always compute for a single open conversation
  // (unlike listConversations, where doing this per-row would multiply
  // out) — isOnline is a live socket-room check, block status two indexed
  // lookups.
  const [isOnline, blockStatus] = other?.user
    ? await Promise.all([
        isUserOnline(other.user.id),
        userService.getBlockStatus(userId, other.user.id),
      ])
    : [false, { blockedByA: false, blockedByB: false }];

  return {
    conversationId,
    type: conversation.type,
    status: conversation.status,
    otherParticipant: other?.user
      ? { ...toDisplayParticipant(other.user), isOnline }
      : null,
    messagesRemaining,
    mediaAllowed,
    iBlockedThem: blockStatus.blockedByA,
    theyBlockedMe: blockStatus.blockedByB,
  };
}

async function listConversations(
  userId: string,
  tab: "active" | "archived",
  cursor: string | undefined,
  limit: number
) {
  const statuses =
    tab === "archived"
      ? [ConversationStatus.ARCHIVED]
      : [ConversationStatus.ACTIVE, ConversationStatus.FROZEN];

  const rows = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      removedAt: null,
      conversation: { status: { in: statuses }, deletedAt: null },
    },
    include: {
      conversation: {
        include: {
          participants: {
            where: { removedAt: null, userId: { not: userId } },
            include: { user: { select: DISPLAY_USER_SELECT } },
          },
          booking: { select: { id: true, status: true, subjectId: true } },
        },
      },
    },
    orderBy: [{ conversation: { lastMessageAt: "desc" } }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const data = page.map((row) => {
    row.conversation.participants.forEach((usr) => {
      usr.user.profilePictureUrl = resolveStorageUrl(
        usr.user.profilePictureUrl
      );
    });

    const otherUser = row.conversation.participants[0]?.user ?? null;

    return {
      conversationId: row.conversationId,
      type: row.conversation.type,
      status: row.conversation.status,
      otherParticipant: otherUser ? toDisplayParticipant(otherUser) : null,
      lastMessagePreview: decodeFromLegacyDb(row.conversation.lastMessagePreview),
      lastMessageAt: row.conversation.lastMessageAt,
      unreadCount: row.unreadCount,
      booking: row.conversation.booking,
    };
  });

  return {
    data,
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit,
    },
  };
}

async function listMessages(
  conversationId: string,
  userId: string,
  cursor: string | undefined,
  limit: number
) {
  await loadConversationForParticipant(conversationId, userId);

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      // A message hidden from its recipient (silent block, see sendMessage)
      // is only ever visible to the sender who sent it.
      OR: [{ hiddenFromRecipient: false }, { senderId: userId }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    include: {
      readReceipts: true,
      replyTo: {
        select: {
          id: true,
          senderId: true,
          content: true,
          contentDeleted: true,
          attachment: {
            select: {
              id: true,
              storagePath: true,
              fileType: true,
              mimeType: true,
              originalFileName: true,
              fileSizeBytes: true,
            },
          },
        },
      },
      attachment: {
        select: {
          id: true,
          storagePath: true,
          fileType: true,
          mimeType: true,
          originalFileName: true,
          fileSizeBytes: true,
        },
      },
    },
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  return {
    data: page.map((m) => ({
      ...serializeMessage(m),
      readBy: m.readReceipts.map((r) => r.userId),
    })),
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit,
    },
  };
}

async function markAsRead(
  conversationId: string,
  userId: string,
  messageIds: string[]
) {
  const { participant } = await loadConversationForParticipant(
    conversationId,
    userId
  );

  const messages = await prisma.message.findMany({
    where: { id: { in: messageIds }, conversationId },
    select: { id: true, senderId: true },
  });
  const unreadOwnMessages = messages.filter((m) => m.senderId !== userId);
  if (!unreadOwnMessages.length)
    return { unreadCount: participant.unreadCount };

  await prisma.$transaction(async (tx) => {
    for (const m of unreadOwnMessages) {
      await tx.messageReadReceipt.upsert({
        where: { messageId_userId: { messageId: m.id, userId } },
        create: { messageId: m.id, userId },
        update: {},
      });
    }
    await tx.message.updateMany({
      where: { id: { in: unreadOwnMessages.map((m) => m.id) } },
      data: { status: MessageStatus.READ },
    });
  });

  const remainingUnread = await prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      deletedAt: null,
      NOT: { readReceipts: { some: { userId } } },
    },
  });
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { unreadCount: remainingUnread, lastReadAt: new Date() },
  });

  const bySender = new Map<string, string[]>();
  for (const m of unreadOwnMessages) {
    bySender.set(m.senderId, [...(bySender.get(m.senderId) ?? []), m.id]);
  }
  emitToConversation(conversationId, "message:read", {
    readerId: userId,
    messageIds: unreadOwnMessages.map((m) => m.id),
  });

  return { unreadCount: remainingUnread };
}

/**
 * Feeds the SAME Trust & Safety review queue the automated content filter
 * already escalates into (ModerationReview, trigger MANUAL_REPORT — a value
 * the enum already had, unused until now) — reusing the existing admin
 * workflow/permissions rather than building a parallel one. Who's being
 * reported isn't a column on ModerationReview; an admin infers it from
 * conversationId's participants minus reportedById, which is unambiguous
 * for a 1:1 conversation.
 */
async function reportUser(
  reporterId: string,
  conversationId: string,
  category: ReportCategory,
  note: string | undefined,
  ctx: ServiceContext
) {
  await loadConversationForParticipant(conversationId, reporterId);

  const reportReason = (note ? `${category}: ${note}` : category).slice(
    0,
    255
  );

  const review = await prisma.moderationReview.create({
    data: {
      conversationId,
      trigger: ModerationReviewTrigger.MANUAL_REPORT,
      reportedById: reporterId,
      reportReason,
    },
  });

  AuditService.record(ctx, "moderation_reviews", {
    operation: "CREATE" as any,
    category: "WRITE" as any,
    recordId: review.id,
    newState: { trigger: "MANUAL_REPORT", reportReason },
    eventType: "user_reported",
  });

  return { id: review.id };
}

async function getUnreadCount(userId: string) {
  const result = await prisma.conversationParticipant.aggregate({
    where: {
      userId,
      removedAt: null,
      conversation: { status: { not: ConversationStatus.ARCHIVED } },
    },
    _sum: { unreadCount: true },
  });
  return result._sum.unreadCount ?? 0;
}

async function freezeConversation(
  conversationId: string,
  adminUserId: string,
  reason: string,
  ctx: ServiceContext
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation)
    throw new AppError(
      "messaging/errors:conversationNotFound",
      StatusCodes.NOT_FOUND
    );

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.FROZEN,
      frozenById: adminUserId,
      frozenAt: new Date(),
      freezeReason: reason,
    },
  });

  AuditService.record(ctx, "conversations", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: conversationId,
    previousState: { status: conversation.status },
    newState: { status: updated.status, reason },
    eventType: "conversation_frozen",
  });

  emitToConversation(conversationId, "conversation:frozen", { reason });
  return updated;
}

async function unfreezeConversation(
  conversationId: string,
  adminUserId: string,
  ctx: ServiceContext
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation)
    throw new AppError(
      "messaging/errors:conversationNotFound",
      StatusCodes.NOT_FOUND
    );

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.ACTIVE,
      frozenById: null,
      frozenAt: null,
      freezeReason: null,
    },
  });

  AuditService.record(ctx, "conversations", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: conversationId,
    previousState: { status: conversation.status },
    newState: { status: updated.status },
    eventType: "conversation_unfrozen",
  });

  emitToConversation(conversationId, "conversation:unfrozen", {});
  return updated;
}

/** Admin-only soft delete — content replaced with a fixed removal notice, visible to both parties. */
async function deleteMessage(
  messageId: string,
  adminUserId: string,
  ctx: ServiceContext
) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message)
    throw new AppError(
      "messaging/errors:messageNotFound",
      StatusCodes.NOT_FOUND
    );

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      contentDeleted: true,
      deletedById: adminUserId,
      deletedAt: new Date(),
      status: MessageStatus.DELETED,
    },
  });

  AuditService.record(ctx, "messages", {
    operation: "DELETE" as any,
    category: "WRITE" as any,
    recordId: messageId,
    previousState: { content: "[redacted from audit log]" },
    newState: { contentDeleted: true },
    eventType: "message_deleted_by_admin",
  });

  emitToConversation(message.conversationId, "message:deleted", { messageId });
  return serializeMessage(updated);
}

async function warnParticipant(
  conversationId: string,
  moderatorUserId: string,
  note: string,
  ctx: ServiceContext
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation)
    throw new AppError(
      "messaging/errors:conversationNotFound",
      StatusCodes.NOT_FOUND
    );

  AuditService.record(ctx, "conversations", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: conversationId,
    newState: { note },
    eventType: "conversation_warning_issued",
  });

  emitToConversation(conversationId, "conversation:warning", { note });
  return { conversationId, note };
}

async function listModerationQueue(
  status: string | undefined,
  cursor: string | undefined,
  limit: number
) {
  const where: any = {};
  if (status) where.status = status;

  const rows = await prisma.moderationReview.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    include: {
      filterBlock: true,
      conversation: {
        select: {
          id: true,
          type: true,
          status: true,
          blockCountConversation: true,
        },
      },
    },
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const data = page.map((row) => ({
    ...row,
    filterBlock: row.filterBlock
      ? {
          ...row.filterBlock,
          attemptedContent: decodeFromLegacyDb(row.filterBlock.attemptedContent),
          normalisedContent: decodeFromLegacyDb(row.filterBlock.normalisedContent),
        }
      : null,
  }));

  return {
    data,
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit,
    },
  };
}

async function reviewModerationItem(
  moderationReviewId: string,
  reviewerId: string,
  status: "REVIEWED" | "ESCALATED" | "RESOLVED",
  reviewNote: string | undefined,
  ctx: ServiceContext
) {
  const review = await prisma.moderationReview.findUnique({
    where: { id: moderationReviewId },
  });
  if (!review)
    throw new AppError(
      "messaging/errors:moderationReviewNotFound",
      StatusCodes.NOT_FOUND
    );

  const updated = await prisma.moderationReview.update({
    where: { id: moderationReviewId },
    data: {
      status,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  AuditService.record(ctx, "moderation_reviews", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: moderationReviewId,
    previousState: { status: review.status },
    newState: { status: updated.status },
    eventType: "moderation_review_updated",
  });

  return updated;
}

async function getConversationForAdmin(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { include: { user: { select: DISPLAY_USER_SELECT } } },
      messages: { orderBy: { createdAt: "asc" } },
      filterBlocks: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!conversation)
    throw new AppError(
      "messaging/errors:conversationNotFound",
      StatusCodes.NOT_FOUND
    );

  conversation.participants.forEach((participant) => {
    participant.user.profilePictureUrl = resolveStorageUrl(
      participant.user.profilePictureUrl
    );
  });

  return {
    ...conversation,
    messages: conversation.messages.map((m) => ({
      ...m,
      content: decodeFromLegacyDb(m.content),
    })),
    filterBlocks: conversation.filterBlocks.map((b) => ({
      ...b,
      attemptedContent: decodeFromLegacyDb(b.attemptedContent),
      normalisedContent: decodeFromLegacyDb(b.normalisedContent),
    })),
  };
}

export const MessagingService = {
  startConversation,
  upgradeToActiveForBooking,
  archiveForBooking,
  sendMessage,
  getConversationSummaryForUser,
  listConversations,
  listMessages,
  markAsRead,
  reportUser,
  getUnreadCount,
  freezeConversation,
  unfreezeConversation,
  deleteMessage,
  warnParticipant,
  listModerationQueue,
  reviewModerationItem,
  getConversationForAdmin,
  loadConversationForParticipant,
};

export default MessagingService;
