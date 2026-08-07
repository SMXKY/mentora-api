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
import { emitToConversation, isUserOnline } from "../../socket/index";
import { filterMessage } from "../../services/messaging/contentFilter";
import { messagingConfig } from "../../services/messaging/messagingConfig";
import { resolveStorageUrl } from "../../services/media";
import { encodeForLegacyDb, decodeFromLegacyDb } from "../../utils/legacyTextEncoding.util";

const DISPLAY_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePictureUrl: true,
  tutorProfile: { select: { id: true } },
};

type DisplayUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  tutorProfile: { id: string } | null;
};

/** Flattens the tutorProfile relation into a tutorProfileId the client can
 * link straight to the public tutor profile route — null for non-tutors. */
function toDisplayParticipant(user: DisplayUser) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePictureUrl: user.profilePictureUrl,
    tutorProfileId: user.tutorProfile?.id ?? null,
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

/** REQ — booking completed/cancelled/resolved-dispute archives the conversation (read-only, permanent). */
async function archiveForBooking(bookingId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { bookingId },
  });
  if (!conversation) return null;
  if (conversation.status === ConversationStatus.ARCHIVED) return conversation;
  return prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: ConversationStatus.ARCHIVED },
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

type ReplyToPreview = {
  id: string;
  senderId: string;
  content: string;
  contentDeleted: boolean;
} | null;

function serializeReplyTo(replyTo: ReplyToPreview) {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    senderId: replyTo.senderId,
    content: replyTo.contentDeleted ? null : decodeFromLegacyDb(replyTo.content),
    contentDeleted: replyTo.contentDeleted,
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
  if (conversation.status === ConversationStatus.ARCHIVED) {
    throw new AppError(
      "messaging/errors:conversationArchived",
      StatusCodes.FORBIDDEN
    );
  }

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
      select: { id: true, senderId: true, content: true, contentDeleted: true },
    });
    if (!replyTo) {
      throw new AppError(
        "messaging/errors:replyToNotFound",
        StatusCodes.BAD_REQUEST
      );
    }
  }

  const { inquiryMessageLimit } = await messagingConfig.getAll();
  if (conversation.type === ConversationType.INQUIRY) {
    const messageCount = await prisma.message.count({
      where: { conversationId, contentDeleted: false },
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
    const outcome = filterMessage(
      trimmed,
      activeKeywordRows.map((k) => k.keyword)
    );

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
      },
    });
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
    return created;
  });

  const recipients = conversation.participants.filter(
    (p) => p.userId !== senderId
  );

  const onlineFlags = await Promise.all(
    recipients.map((r) => isUserOnline(r.userId))
  );
  const anyRecipientOnline = onlineFlags.some(Boolean);
  const finalMessage = anyRecipientOnline
    ? await prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.DELIVERED, deliveredAt: new Date() },
      })
    : message;

  const serialized = serializeMessage({ ...finalMessage, replyTo, attachment });

  emitToConversation(conversationId, "message:new", serialized);

  await Promise.all(
    recipients.map((r) =>
      NotificationService.send({
        type: NotificationType.NEW_MESSAGE_RECEIVED,
        target: { kind: "user", userId: r.userId },
        resourceType: NotificationResourceType.MESSAGE,
        resourceId: finalMessage.id,
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

  let messagesRemaining: number | null = null;
  if (conversation.type === ConversationType.INQUIRY) {
    const { inquiryMessageLimit } = await messagingConfig.getAll();
    const messageCount = await prisma.message.count({
      where: { conversationId, contentDeleted: false },
    });
    messagesRemaining = Math.max(inquiryMessageLimit - messageCount, 0);
  }

  return {
    conversationId,
    type: conversation.type,
    status: conversation.status,
    otherParticipant: other?.user ? toDisplayParticipant(other.user) : null,
    messagesRemaining,
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
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    include: {
      readReceipts: true,
      replyTo: {
        select: { id: true, senderId: true, content: true, contentDeleted: true },
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
