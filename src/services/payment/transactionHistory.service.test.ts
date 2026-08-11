import { AppError } from "../../utils/AppError.util";

const mockPrisma: any = {
  transactionLedger: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  receipt: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockGetFileUrl = jest.fn();
jest.mock("../media/media.service", () => ({
  MediaService: { getFileUrl: (...args: unknown[]) => mockGetFileUrl(...args) },
}));

const mockBuildGenericTransactionReceipt = jest.fn();
jest.mock("./receipt.service", () => ({
  ReceiptService: {
    buildGenericTransactionReceipt: (...args: unknown[]) => mockBuildGenericTransactionReceipt(...args),
  },
}));

import { TransactionHistoryService } from "./transactionHistory.service";

const USER = "user-1";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TransactionHistoryService.listMyTransactions", () => {
  function row(overrides: Partial<any> = {}) {
    return {
      id: "tx-1",
      operation: "BOOKING_PAYMENT",
      amountXaf: 5000,
      momoFeeXaf: 100,
      status: "SUCCESS",
      createdAt: new Date("2026-01-15"),
      fromUserId: USER,
      toUserId: "tutor-1",
      isPlatformSender: false,
      isPlatformReceiver: false,
      fromUser: { firstName: "A", lastName: "B" },
      toUser: { firstName: "C", lastName: "D" },
      booking: null,
      ...overrides,
    };
  }

  it("reports hasNextPage=false and no cursor when rows fit within the limit", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([row()]);

    const result = await TransactionHistoryService.listMyTransactions(USER, { limit: 10 });

    expect(result.meta).toEqual({ nextCursor: null, hasNextPage: false, limit: 10 });
    expect(result.data).toHaveLength(1);
  });

  it("reports hasNextPage=true and the correct cursor when an extra row was fetched", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([
      row({ id: "tx-1" }),
      row({ id: "tx-2" }),
      row({ id: "tx-3" }), // the +1 lookahead row, sliced off
    ]);

    const result = await TransactionHistoryService.listMyTransactions(USER, { limit: 2 });

    expect(result.meta).toEqual({ nextCursor: "tx-2", hasNextPage: true, limit: 2 });
    expect(result.data.map((d) => d.id)).toEqual(["tx-1", "tx-2"]);
  });

  it("derives OUT direction when the viewer is the sender, and resolves the counterparty from the other side", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([
      row({ fromUserId: USER, toUserId: "tutor-1", toUser: { firstName: "Tutor", lastName: "One" } }),
    ]);

    const result = await TransactionHistoryService.listMyTransactions(USER, { limit: 10 });

    expect(result.data[0].direction).toBe("OUT");
    expect(result.data[0].counterparty).toBe("Tutor One");
  });

  it("derives IN direction when the viewer is the recipient", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([
      row({ fromUserId: "payer-1", toUserId: USER, fromUser: { firstName: "Payer", lastName: "One" } }),
    ]);

    const result = await TransactionHistoryService.listMyTransactions(USER, { limit: 10 });

    expect(result.data[0].direction).toBe("IN");
    expect(result.data[0].counterparty).toBe("Payer One");
  });

  it("labels the counterparty as Mentora when the platform is the sender/receiver", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([
      row({ fromUserId: USER, toUserId: null, isPlatformReceiver: true }),
    ]);

    const result = await TransactionHistoryService.listMyTransactions(USER, { limit: 10 });

    expect(result.data[0].counterparty).toBe("Mentora");
  });

  it("surfaces subjectName/tutorName from the joined booking when present", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([
      row({
        booking: {
          id: "booking-1",
          subject: { id: "s1", name: "Mathematics" },
          tutorProfile: { id: "tp1", user: { firstName: "Ada", lastName: "L." } },
        },
      }),
    ]);

    const result = await TransactionHistoryService.listMyTransactions(USER, { limit: 10 });

    expect(result.data[0].bookingId).toBe("booking-1");
    expect(result.data[0].subjectName).toBe("Mathematics");
    expect(result.data[0].tutorName).toBe("Ada L.");
  });

  it("builds a nested booking where-clause for subjectId/tutorProfileId/search filters", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([]);

    await TransactionHistoryService.listMyTransactions(USER, {
      limit: 10,
      subjectId: "subject-1",
      tutorProfileId: "tutor-profile-1",
      search: "algebra",
    });

    const callArgs = mockPrisma.transactionLedger.findMany.mock.calls[0][0];
    expect(callArgs.where.booking).toEqual(
      expect.objectContaining({
        subjectId: "subject-1",
        tutorProfileId: "tutor-profile-1",
        OR: expect.any(Array),
      })
    );
  });

  it("sorts by amount when sortBy is 'amount', with the id tie-break in the same direction", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([]);

    await TransactionHistoryService.listMyTransactions(USER, {
      limit: 10,
      sortBy: "amount",
      sortDir: "asc",
    });

    const callArgs = mockPrisma.transactionLedger.findMany.mock.calls[0][0];
    expect(callArgs.orderBy).toEqual([{ amountXaf: "asc" }, { id: "asc" }]);
  });

  it("defaults to sorting by createdAt desc", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([]);

    await TransactionHistoryService.listMyTransactions(USER, { limit: 10 });

    const callArgs = mockPrisma.transactionLedger.findMany.mock.calls[0][0];
    expect(callArgs.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("passes cursor+skip:1 when a cursor is given", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([]);

    await TransactionHistoryService.listMyTransactions(USER, { limit: 10, cursor: "tx-5" });

    const callArgs = mockPrisma.transactionLedger.findMany.mock.calls[0][0];
    expect(callArgs.cursor).toEqual({ id: "tx-5" });
    expect(callArgs.skip).toBe(1);
  });
});

describe("TransactionHistoryService.getMyTransactionSummary", () => {
  it("buckets rows into the correct month and derives totalIn/totalOut per viewer direction", async () => {
    // Anchored to "now" (not a fixed calendar date) so this stays correct
    // regardless of when the suite runs — getMyTransactionSummary's window
    // is always relative to the current month.
    const thisMonth = new Date();
    thisMonth.setUTCDate(10);
    mockPrisma.transactionLedger.findMany.mockResolvedValue([
      { createdAt: thisMonth, amountXaf: 1000, momoFeeXaf: 50, fromUserId: USER },
      { createdAt: thisMonth, amountXaf: 2000, momoFeeXaf: null, fromUserId: "other" },
    ]);
    mockPrisma.transactionLedger.groupBy.mockResolvedValue([]);

    const summary = await TransactionHistoryService.getMyTransactionSummary(USER, 1);

    expect(summary.monthly).toHaveLength(1);
    expect(summary.monthly[0].totalOutXaf).toBe(1000);
    expect(summary.monthly[0].totalInXaf).toBe(2000);
    expect(summary.feesTotalXaf).toBe(50);
  });

  it("zero-fills every month in the window even with no transactions", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([]);
    mockPrisma.transactionLedger.groupBy.mockResolvedValue([]);

    const summary = await TransactionHistoryService.getMyTransactionSummary(USER, 3);

    expect(summary.monthly).toHaveLength(3);
    expect(summary.monthly.every((m) => m.totalInXaf === 0 && m.totalOutXaf === 0)).toBe(true);
  });

  it("maps the operation-breakdown groupBy result into {operation, totalXaf} pairs", async () => {
    mockPrisma.transactionLedger.findMany.mockResolvedValue([]);
    mockPrisma.transactionLedger.groupBy.mockResolvedValue([
      { operation: "BOOKING_PAYMENT", _sum: { amountXaf: 15000 } },
      { operation: "WALLET_TOPUP", _sum: { amountXaf: 5000 } },
    ]);

    const summary = await TransactionHistoryService.getMyTransactionSummary(USER, 6);

    expect(summary.byOperation).toEqual([
      { operation: "BOOKING_PAYMENT", totalXaf: 15000 },
      { operation: "WALLET_TOPUP", totalXaf: 5000 },
    ]);
  });
});

describe("TransactionHistoryService.getOrCreateReceiptForLedgerEntry", () => {
  const entry = {
    id: "tx-1",
    fromUserId: USER,
    toUserId: "tutor-1",
    bookingId: null as string | null,
    metadata: null as Record<string, unknown> | null,
    operation: "WALLET_TOPUP",
    amountXaf: 5000,
    momoFeeXaf: 100,
    isPlatformSender: false,
    isPlatformReceiver: true,
    createdAt: new Date("2026-01-15"),
  };

  it("404s when the ledger entry doesn't exist", async () => {
    mockPrisma.transactionLedger.findUnique.mockResolvedValue(null);

    await expect(
      TransactionHistoryService.getOrCreateReceiptForLedgerEntry(USER, "missing")
    ).rejects.toMatchObject(new AppError("payment/errors:transactionNotFound", 404));
  });

  it("404s when the requesting user is neither the sender nor the receiver", async () => {
    mockPrisma.transactionLedger.findUnique.mockResolvedValue({
      ...entry,
      fromUserId: "someone-else",
      toUserId: "someone-else-too",
    });

    await expect(
      TransactionHistoryService.getOrCreateReceiptForLedgerEntry(USER, "tx-1")
    ).rejects.toMatchObject(new AppError("payment/errors:transactionNotFound", 404));
  });

  it("reuses an existing booking Receipt's file when the entry is booking-linked", async () => {
    mockPrisma.transactionLedger.findUnique.mockResolvedValue({ ...entry, bookingId: "booking-1" });
    mockPrisma.receipt.findFirst.mockResolvedValue({ id: "receipt-1", fileId: "file-1" });
    mockGetFileUrl.mockResolvedValue("https://cdn.example/file-1.pdf");

    const result = await TransactionHistoryService.getOrCreateReceiptForLedgerEntry(USER, "tx-1");

    expect(result.fileUrl).toBe("https://cdn.example/file-1.pdf");
    expect(mockGetFileUrl).toHaveBeenCalledWith("file-1");
    expect(mockBuildGenericTransactionReceipt).not.toHaveBeenCalled();
  });

  it("reuses a cached metadata.receiptFileId without regenerating the PDF", async () => {
    mockPrisma.transactionLedger.findUnique.mockResolvedValue({
      ...entry,
      metadata: { receiptFileId: "cached-file-1" },
    });
    mockGetFileUrl.mockResolvedValue("https://cdn.example/cached-file-1.pdf");

    const result = await TransactionHistoryService.getOrCreateReceiptForLedgerEntry(USER, "tx-1");

    expect(result.fileUrl).toBe("https://cdn.example/cached-file-1.pdf");
    expect(mockGetFileUrl).toHaveBeenCalledWith("cached-file-1");
    expect(mockBuildGenericTransactionReceipt).not.toHaveBeenCalled();
  });

  it("generates a fresh receipt and caches its fileId when nothing exists yet", async () => {
    mockPrisma.transactionLedger.findUnique.mockResolvedValue(entry);
    mockPrisma.user.findUnique.mockResolvedValue(null); // platform counterparty
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ firstName: "Jane", lastName: "Doe" });
    mockBuildGenericTransactionReceipt.mockResolvedValue("new-file-1");
    mockGetFileUrl.mockResolvedValue("https://cdn.example/new-file-1.pdf");

    const result = await TransactionHistoryService.getOrCreateReceiptForLedgerEntry(USER, "tx-1");

    expect(mockBuildGenericTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ ledgerEntryId: "tx-1", userId: USER, operation: "WALLET_TOPUP" })
    );
    expect(mockPrisma.transactionLedger.update).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: { metadata: { receiptFileId: "new-file-1" } },
    });
    expect(result.fileUrl).toBe("https://cdn.example/new-file-1.pdf");
  });

  it("preserves existing metadata keys when caching the new receiptFileId", async () => {
    mockPrisma.transactionLedger.findUnique.mockResolvedValue({
      ...entry,
      metadata: { providerCallback: { some: "data" } },
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ firstName: "Jane", lastName: "Doe" });
    mockBuildGenericTransactionReceipt.mockResolvedValue("new-file-2");
    mockGetFileUrl.mockResolvedValue("https://cdn.example/new-file-2.pdf");

    await TransactionHistoryService.getOrCreateReceiptForLedgerEntry(USER, "tx-1");

    expect(mockPrisma.transactionLedger.update).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: { metadata: { providerCallback: { some: "data" }, receiptFileId: "new-file-2" } },
    });
  });
});
