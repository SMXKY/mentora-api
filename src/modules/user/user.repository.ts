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

  // ============================================================
  // ROLES BY DEFAULT
  // Every admin-facing "get users" read (list, search, get-by-id,
  // deleted-list, deleted-get-by-id) includes role data without the
  // caller needing ?include=userRoles — userRoles is merged into the
  // include on every read below and flattened to a plain `roles:
  // string[]` of role names, matching the shape UserService.getMe()
  // already uses for the self-service /me endpoint.
  // ============================================================

  private readonly rolesInclude = {
    userRoles: { where: { isActive: true }, include: { role: true } },
  };

  private withRolesInclude(
    include?: Record<string, boolean | object>
  ): Record<string, boolean | object> {
    return { ...(include ?? {}), ...this.rolesInclude };
  }

  private flattenRoles<R>(record: R): R {
    if (record && typeof record === "object" && "userRoles" in (record as any)) {
      const { userRoles, ...rest } = record as any;
      return { ...rest, roles: (userRoles as any[]).map((ur) => ur.role.name) } as R;
    }
    return record;
  }

  private flattenRolesFromList<R>(records: R[]): R[] {
    return records.map((r) => this.flattenRoles(r));
  }

  // ============================================================
  // FAMILY CONTEXT ON EVERY ADMIN USER FETCH
  // Admin viewing user records also needs to see the family relationship
  // either direction: a parent's associated students
  // (studentProfilesGuarded), and a guardian-managed student's parent
  // (studentProfiles[].guardian). Applied to both the single-record reads
  // (findById/findDeletedById) and the list/search reads (findMany/
  // findManyCursor/findDeleted) — the nested selects are already scoped to
  // a handful of fields (see familyInclude below), so the per-row payload
  // cost on a list is small relative to the value of not requiring a
  // second round-trip per parent row in the admin UI.
  // ============================================================

  private readonly familyInclude = {
    studentProfiles: {
      where: { deletedAt: null },
      include: {
        guardian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    },
    studentProfilesGuarded: {
      where: { deletedAt: null },
      select: {
        id: true,
        userId: true,
        firstName: true,
        dob: true,
        levelId: true,
        schoolType: true,
      },
    },
  };

  private withFamilyInclude(
    include?: Record<string, boolean | object>
  ): Record<string, boolean | object> {
    return { ...(include ?? {}), ...this.familyInclude };
  }

  async findById(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<any> {
    const record = await super.findById(
      id,
      this.withFamilyInclude(this.withRolesInclude(include))
    );
    return this.flattenRoles(this.omitPassword(record));
  }

  async findOne(
    where: Record<string, any>,
    include?: Record<string, boolean | object>
  ): Promise<any> {
    const record = await super.findOne(where, this.withRolesInclude(include));
    return this.flattenRoles(this.omitPassword(record));
  }

  async findAll(
    where: Record<string, any> = {},
    include?: Record<string, boolean | object>
  ): Promise<any[]> {
    const records = await super.findAll(where, this.withRolesInclude(include));
    return this.flattenRolesFromList(this.omitPasswordFromList(records));
  }

  async findMany(
    options: OffsetFindOptions = {}
  ): Promise<OffsetPaginatedResult<any>> {
    const result = await super.findMany(
      options.select
        ? options
        : { ...options, include: this.withFamilyInclude(this.withRolesInclude(options.include)) }
    );
    return { ...result, data: this.flattenRolesFromList(this.omitPasswordFromList(result.data)) };
  }

  async findManyCursor(
    options: CursorFindOptions = {}
  ): Promise<CursorPaginatedResult<any>> {
    const result = await super.findManyCursor(
      options.select
        ? options
        : { ...options, include: this.withFamilyInclude(this.withRolesInclude(options.include)) }
    );
    return { ...result, data: this.flattenRolesFromList(this.omitPasswordFromList(result.data)) };
  }

  async findDeleted(
    options: OffsetFindOptions = {}
  ): Promise<OffsetPaginatedResult<any>> {
    const result = await super.findDeleted(
      options.select
        ? options
        : { ...options, include: this.withFamilyInclude(this.withRolesInclude(options.include)) }
    );
    return { ...result, data: this.flattenRolesFromList(this.omitPasswordFromList(result.data)) };
  }

  async findDeletedById(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<any> {
    const record = await super.findDeletedById(
      id,
      this.withFamilyInclude(this.withRolesInclude(include))
    );
    return this.flattenRoles(this.omitPassword(record));
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
