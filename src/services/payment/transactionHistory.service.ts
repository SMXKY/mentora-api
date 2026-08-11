import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { LedgerOperation } from "../../generated/prisma";

const DISPLAY_USER_SELECT = { id: true, firstName: true, lastName: true };

function displayName(user: { firstName: string | null; lastName: string | null } | null): string | null {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
}

export interface ListTransactionsFilters {
  cursor?: string;
  limit: number;
  operation?: LedgerOperation;
  dateFrom?: string;
  dateTo?: string;
  subjectId?: string;
  tutorProfileId?: string;
  search?: string;
  sortBy?: "date" | "amount";
  sortDir?: "asc" | "desc";
}

// Selected once here and reused by both listMyTransactions and
// getMyTransactionSummary so the two queries stay in sync on what a
// "transaction visible to this user" even means.
function forUserWhere(userId: string) {
  return { OR: [{ fromUserId: userId }, { toUserId: userId }] };
}

/** Cursor-paginated transaction list for the current user — mirrors
 * booking.service.ts's listMyBookings (same take:limit+1 / cursor+skip:1 /
 * [{sortField,sortDir},{id,sortDir}] tie-break shape). Subject/tutor live on
 * the linked Booking, not the ledger row itself, so filtering/searching by
 * either goes through a nested `booking` relation filter. */
async function listMyTransactions(userId: string, filters: ListTransactionsFilters) {
  const where: any = forUserWhere(userId);
  if (filters.operation) where.operation = filters.operation;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom && { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) }),
      ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) }),
    };
  }

  const bookingWhere: any = {};
  if (filters.subjectId) bookingWhere.subjectId = filters.subjectId;
  if (filters.tutorProfileId) bookingWhere.tutorProfileId = filters.tutorProfileId;
  if (filters.search) {
    const q = filters.search.trim();
    if (q) {
      bookingWhere.OR = [
        { subject: { name: { contains: q, mode: "insensitive" } } },
        {
          tutorProfile: {
            user: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }
  }
  if (Object.keys(bookingWhere).length > 0) where.booking = bookingWhere;

  const sortField = filters.sortBy === "amount" ? "amountXaf" : "createdAt";
  const sortDir = filters.sortDir ?? "desc";

  const rows = await prisma.transactionLedger.findMany({
    where,
    orderBy: [{ [sortField]: sortDir }, { id: sortDir }],
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
    take: filters.limit + 1,
    include: {
      fromUser: { select: DISPLAY_USER_SELECT },
      toUser: { select: DISPLAY_USER_SELECT },
      booking: {
        select: {
          id: true,
          subject: { select: { id: true, name: true } },
          tutorProfile: { select: { id: true, user: { select: DISPLAY_USER_SELECT } } },
        },
      },
    },
  });

  const hasNextPage = rows.length > filters.limit;
  const page = hasNextPage ? rows.slice(0, filters.limit) : rows;
  const nextCursor = page.length > 0 ? page[page.length - 1].id : null;

  return {
    data: page.map((row) => serializeTransaction(row, userId)),
    meta: {
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
      limit: filters.limit,
    },
  };
}

function serializeTransaction(
  row: {
    id: string;
    operation: LedgerOperation;
    amountXaf: number;
    momoFeeXaf: number | null;
    status: string;
    createdAt: Date;
    fromUserId: string | null;
    toUserId: string | null;
    isPlatformSender: boolean;
    isPlatformReceiver: boolean;
    fromUser: { firstName: string | null; lastName: string | null } | null;
    toUser: { firstName: string | null; lastName: string | null } | null;
    booking: {
      id: string;
      subject: { id: string; name: string };
      tutorProfile: { id: string; user: { firstName: string | null; lastName: string | null } };
    } | null;
  },
  userId: string
) {
  // Direction is relative to the viewer, not a fixed property of the row —
  // the same ledger entry reads as OUT for the payer and IN for the payee.
  const direction: "IN" | "OUT" = row.fromUserId === userId ? "OUT" : "IN";
  const counterpartyIsPlatform = direction === "OUT" ? row.isPlatformReceiver : row.isPlatformSender;
  const counterpartyUser = direction === "OUT" ? row.toUser : row.fromUser;

  return {
    id: row.id,
    operation: row.operation,
    direction,
    amountXaf: row.amountXaf,
    momoFeeXaf: row.momoFeeXaf,
    status: row.status,
    createdAt: row.createdAt,
    counterparty: counterpartyIsPlatform ? "Mentora" : displayName(counterpartyUser),
    bookingId: row.booking?.id ?? null,
    subjectName: row.booking?.subject.name ?? null,
    tutorName: row.booking ? displayName(row.booking.tutorProfile.user) : null,
  };
}

const MONTH_KEY_FORMAT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short" });

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Simple analytics for the wallet dashboard: monthly in/out totals, an
 * operation-type breakdown, and total fees paid — all computed from one
 * pass over this user's ledger rows in the window (fees folded into the
 * same pass, no extra query), plus one groupBy for the breakdown. */
async function getMyTransactionSummary(userId: string, months = 6) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const where = { ...forUserWhere(userId), createdAt: { gte: since } };

  const rows = await prisma.transactionLedger.findMany({
    where,
    select: { createdAt: true, amountXaf: true, momoFeeXaf: true, fromUserId: true },
  });

  // Zero-fill every month in the window, oldest first, so a short history
  // still renders a full-width chart instead of a lopsided one.
  const monthly = new Map<string, { month: string; totalInXaf: number; totalOutXaf: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setUTCMonth(d.getUTCMonth() + i);
    const key = monthKey(d);
    monthly.set(key, { month: MONTH_KEY_FORMAT.format(d), totalInXaf: 0, totalOutXaf: 0 });
  }

  let feesTotalXaf = 0;
  for (const row of rows) {
    const bucket = monthly.get(monthKey(row.createdAt));
    if (bucket) {
      if (row.fromUserId === userId) bucket.totalOutXaf += row.amountXaf;
      else bucket.totalInXaf += row.amountXaf;
    }
    feesTotalXaf += row.momoFeeXaf ?? 0;
  }

  const byOperationRaw = await prisma.transactionLedger.groupBy({
    by: ["operation"],
    where,
    _sum: { amountXaf: true },
  });

  return {
    monthly: Array.from(monthly.values()),
    byOperation: byOperationRaw.map((r) => ({
      operation: r.operation,
      totalXaf: r._sum.amountXaf ?? 0,
    })),
    feesTotalXaf,
  };
}

/** Resolves a downloadable PDF receipt for any ledger entry, generating one
 * on demand for operations that never went through the booking-payment
 * Receipt flow (topups, withdrawals, escrow releases, commission
 * deductions, etc). Booking-payment entries reuse the existing Receipt row;
 * everything else is generated once and cached via metadata.receiptFileId
 * so a repeat download doesn't regenerate the PDF. */
async function getOrCreateReceiptForLedgerEntry(userId: string, ledgerEntryId: string): Promise<{ fileUrl: string }> {
  // Deferred imports — avoids a require-cycle with receipt.service.ts,
  // which doesn't otherwise need to know about transaction history.
  const { ReceiptService } = await import("./receipt.service");
  const { MediaService } = await import("../media/media.service");

  const entry = await prisma.transactionLedger.findUnique({ where: { id: ledgerEntryId } });
  if (!entry) {
    throw new AppError("payment/errors:transactionNotFound", StatusCodes.NOT_FOUND);
  }
  if (entry.fromUserId !== userId && entry.toUserId !== userId) {
    throw new AppError("payment/errors:transactionNotFound", StatusCodes.NOT_FOUND);
  }

  if (entry.bookingId) {
    const receipt = await prisma.receipt.findFirst({
      where: { bookingId: entry.bookingId, userId },
    });
    if (receipt) {
      const fileUrl = await MediaService.getFileUrl(receipt.fileId);
      return { fileUrl };
    }
  }

  const existingMetadata = (entry.metadata as Record<string, unknown> | null) ?? {};
  const cachedFileId = existingMetadata.receiptFileId as string | undefined;
  if (cachedFileId) {
    const fileUrl = await MediaService.getFileUrl(cachedFileId);
    return { fileUrl };
  }

  const [counterparty, user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: entry.fromUserId === userId ? entry.toUserId ?? undefined : entry.fromUserId ?? undefined },
      select: DISPLAY_USER_SELECT,
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  const fileId = await ReceiptService.buildGenericTransactionReceipt({
    ledgerEntryId: entry.id,
    userId,
    userName: displayName(user) || "Mentora user",
    operation: entry.operation,
    amountXaf: entry.amountXaf,
    momoFeeXaf: entry.momoFeeXaf,
    counterpartyName:
      entry.fromUserId === userId
        ? entry.isPlatformReceiver
          ? "Mentora"
          : displayName(counterparty) || "Mentora user"
        : entry.isPlatformSender
          ? "Mentora"
          : displayName(counterparty) || "Mentora user",
    createdAt: entry.createdAt,
  });

  await prisma.transactionLedger.update({
    where: { id: entry.id },
    data: { metadata: { ...existingMetadata, receiptFileId: fileId } },
  });

  const fileUrl = await MediaService.getFileUrl(fileId);
  return { fileUrl };
}

export const TransactionHistoryService = {
  listMyTransactions,
  getMyTransactionSummary,
  getOrCreateReceiptForLedgerEntry,
};
export default TransactionHistoryService;
