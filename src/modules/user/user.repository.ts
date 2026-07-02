import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";
import {
  OffsetFindOptions,
  CursorFindOptions,
  OffsetPaginatedResult,
  CursorPaginatedResult,
} from "../../base/base.types";

export class UserRepository extends BaseRepository<any> {
  protected modelName = "user";

  // Fields the ?search= query param searches across
  protected searchableFields: string[] = [
    "email",
    "firstName",
    "lastName",
    "username",
    "phoneNumber",
  ];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = ["rolePermissionsCreated", "userRoles", "userRolesCreated", "permissionOverrides", "permissionOverridesCreated", "ipBlocksCreated", "auditLogs", "devices", "sessions", "sessionsTerminated", "platformTokens", "paymentAccounts", "suspensions", "suspensionsLifted", "suspensionsCreated", "studentProfiles", "tutorProfile", "relationshipWeightsSet", "credentialsReviewed", "tutorSubjectsApproved", "filesUploaded", "quotaDefaultsCreated", "quotaOverride", "quotaOverridesGranted", "storageUsage", "materialAccess", "materialReviewsActioned", "materialReviewsAgainst", "materialReviewsReported", "kycStatusChanges", "kycChecklistSubmissions", "kycBansIssued", "demandSignals", "bookingSeries", "bookings", "bookingsCancelled", "groupParticipations", "rescheduleRequests", "rescheduleResponses", "notifications", "scheduledNotifications", "notificationPrefs", "pushTokens", "wallet", "escrowHoldsPaid", "escrowHoldsReceiving", "ledgerEntriesFrom", "ledgerEntriesTo", "ledgerAdjustments", "payoutQueueEntries", "idempotencyKeys", "paymentReconciliations", "transactionIssues", "transactionIssuesResolved", "receipts", "sessionParticipations", "participantEvents", "participantEventsActioned", "connectionQualityEvents", "conversationsFrozen", "conversationParticipations", "conversationMembersAdded", "conversationMembersRemoved", "messagesSent", "messagesDeleted", "messageReadReceipts", "filterBlocks", "moderationReportsFiled", "moderationReviewsDone", "sessionChatMessages", "sessionChatMessagesDeleted", "filterKeywordsAdded", "lessonConfirmations", "disputesOpened", "disputesAssigned", "disputesResolved", "disputeEvidenceUploads", "incidentReportsFiled", "incidentReportsAgainst", "incidentReportsReviewed", "reviewWindowsReopened", "reviewsAuthored", "reviewsReceived", "reviewsDeleted", "ratingSnapshot", "reviewReportsFiled", "reviewReportsReviewed", "reviewFraudSignals", "riskScore", "riskReviewsCompleted", "riskSignals", "riskAdjustmentsMade", "riskStateHistory", "riskStatesCleared", "reauthChallenges", "fingerprintEntries", "deadLetterJobs", "deadLetterJobsRetried", "deadLetterJobsDismissed", "ticketsSubmitted", "ticketsAssigned", "ticketsEscalatedTo", "ticketsResolved", "ticketMessages", "ticketAttachments", "ticketStatusChanges", "payoutRetriesInitiated", "reconciliationsResolved", "scheduledReportsCreated", "generatedReports", "heartbeatJobsDisabled", "learningSnapshots", "platformConfigsUpdated", "monthlyFeeCharges"];

  protected softDeleteConfig = {
    enabled: true,
    // email/username are unique — free them up on soft-delete so a
    // new account can reuse them without hitting a unique constraint
    uniqueFields: ["email", "username"] as string[],
  };

  // User has an isSystem field (the seeded Super Admin), and unlike
  // Role it has no service-level check of its own — this is the only
  // thing stopping the seeded system user from being edited/deleted
  // through the generic admin CRUD routes.
  protected hasSystemField = true;

  // ============================================================
  // PASSWORD REDACTION
  // The base findX methods return raw Prisma records, which would
  // otherwise leak the argon2 password hash to any caller with
  // users.read/users.manage. Every read/write path is overridden
  // here to strip it before the record ever reaches the service/
  // controller layer.
  // ============================================================

  private omitPassword<R>(record: R): R {
    if (record && typeof record === "object" && "password" in (record as any)) {
      const { password, ...rest } = record as any;
      return rest as R;
    }
    return record;
  }

  private omitPasswordFromList<R>(records: R[]): R[] {
    return records.map((r) => this.omitPassword(r));
  }

  async findById(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<any> {
    return this.omitPassword(await super.findById(id, include));
  }

  async findOne(
    where: Record<string, any>,
    include?: Record<string, boolean | object>
  ): Promise<any> {
    return this.omitPassword(await super.findOne(where, include));
  }

  async findAll(
    where: Record<string, any> = {},
    include?: Record<string, boolean | object>
  ): Promise<any[]> {
    return this.omitPasswordFromList(await super.findAll(where, include));
  }

  async findMany(
    options: OffsetFindOptions = {}
  ): Promise<OffsetPaginatedResult<any>> {
    const result = await super.findMany(options);
    return { ...result, data: this.omitPasswordFromList(result.data) };
  }

  async findManyCursor(
    options: CursorFindOptions = {}
  ): Promise<CursorPaginatedResult<any>> {
    const result = await super.findManyCursor(options);
    return { ...result, data: this.omitPasswordFromList(result.data) };
  }

  async findDeleted(
    options: OffsetFindOptions = {}
  ): Promise<OffsetPaginatedResult<any>> {
    const result = await super.findDeleted(options);
    return { ...result, data: this.omitPasswordFromList(result.data) };
  }

  async findDeletedById(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<any> {
    return this.omitPassword(await super.findDeletedById(id, include));
  }

  async create(data: Record<string, any>): Promise<any> {
    return this.omitPassword(await super.create(data));
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    return this.omitPassword(await super.update(id, data));
  }

  async restore(id: string): Promise<any> {
    return this.omitPassword(await super.restore(id));
  }

  // TODO: override buildWhereClause if you need custom filtering
  // e.g. enum fields should use exact match not LIKE
  // protected buildWhereClause(filters: any, search?: string) {
  //   const where = super.buildWhereClause(filters, search)
  //   if (filters.status) where.status = filters.status  // exact match
  //   return where
  // }
}
