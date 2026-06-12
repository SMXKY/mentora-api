import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";

export class UserRepository extends BaseRepository<any> {
  protected modelName = "user";

  // Fields the ?search= query param searches across
  // Empty means search is silently ignored
  // TODO: update with the fields that make sense to search
  protected searchableFields: string[] = [];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = ["rolePermissionsCreated", "userRoles", "userRolesCreated", "permissionOverrides", "permissionOverridesCreated", "ipBlocksCreated", "auditLogs", "devices", "sessions", "sessionsTerminated", "platformTokens", "paymentAccounts", "suspensions", "suspensionsLifted", "suspensionsCreated", "studentProfiles", "tutorProfile", "relationshipWeightsSet", "credentialsReviewed", "tutorSubjectsApproved", "filesUploaded", "quotaDefaultsCreated", "quotaOverride", "quotaOverridesGranted", "storageUsage", "materialAccess", "materialReviewsActioned", "materialReviewsAgainst", "materialReviewsReported", "kycStatusChanges", "kycChecklistSubmissions", "kycBansIssued", "demandSignals", "bookingSeries", "bookings", "bookingsCancelled", "groupParticipations", "rescheduleRequests", "rescheduleResponses", "notifications", "scheduledNotifications", "notificationPrefs", "pushTokens", "wallet", "escrowHoldsPaid", "escrowHoldsReceiving", "ledgerEntriesFrom", "ledgerEntriesTo", "ledgerAdjustments", "payoutQueueEntries", "idempotencyKeys", "paymentReconciliations", "transactionIssues", "transactionIssuesResolved", "receipts", "sessionParticipations", "participantEvents", "participantEventsActioned", "connectionQualityEvents", "conversationsFrozen", "conversationParticipations", "conversationMembersAdded", "conversationMembersRemoved", "messagesSent", "messagesDeleted", "messageReadReceipts", "filterBlocks", "moderationReportsFiled", "moderationReviewsDone", "sessionChatMessages", "sessionChatMessagesDeleted", "filterKeywordsAdded", "lessonConfirmations", "disputesOpened", "disputesAssigned", "disputesResolved", "disputeEvidenceUploads", "incidentReportsFiled", "incidentReportsAgainst", "incidentReportsReviewed", "reviewWindowsReopened", "reviewsAuthored", "reviewsReceived", "reviewsDeleted", "ratingSnapshot", "reviewReportsFiled", "reviewReportsReviewed", "reviewFraudSignals", "riskScore", "riskReviewsCompleted", "riskSignals", "riskAdjustmentsMade", "riskStateHistory", "riskStatesCleared", "reauthChallenges", "fingerprintEntries", "deadLetterJobs", "deadLetterJobsRetried", "deadLetterJobsDismissed", "ticketsSubmitted", "ticketsAssigned", "ticketsEscalatedTo", "ticketsResolved", "ticketMessages", "ticketAttachments", "ticketStatusChanges", "payoutRetriesInitiated", "reconciliationsResolved", "scheduledReportsCreated", "generatedReports", "heartbeatJobsDisabled", "learningSnapshots", "platformConfigsUpdated", "monthlyFeeCharges"];

    protected softDeleteConfig = {
    enabled: true,
    // TODO: add unique fields that need _deleted_timestamp suffix
    // uniqueFields: ['name', 'email'],
    uniqueFields: [] as string[],
  };

  // Set to true if this model has an isSystem boolean field
  protected hasSystemField = false;

  // TODO: override buildWhereClause if you need custom filtering
  // e.g. enum fields should use exact match not LIKE
  // protected buildWhereClause(filters: any, search?: string) {
  //   const where = super.buildWhereClause(filters, search)
  //   if (filters.status) where.status = filters.status  // exact match
  //   return where
  // }
}
