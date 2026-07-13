import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ── Shared sub-shapes ─────────────────────────────────────────

const BookingSummarySchema = z.object({
  id: z.string().uuid(),
  tutorName: z.string().nullable(),
  studentName: z.string().nullable(),
  subject: z.string().nullable(),
  sessionDate: z.string().datetime(),
  sessionStartTime: z.string(),
  sessionType: z.string(),
  status: z.string(),
});

const DisputeSummarySchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  status: z.string(),
  reason: z.string(),
  updatedAt: z.string().datetime(),
});

const PaymentSummarySchema = z.object({
  id: z.string().uuid(),
  grossAmountXaf: z.number(),
  status: z.string(),
  createdAt: z.string().datetime(),
});

const StudentProfileSummarySchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  levelName: z.string().nullable(),
  activeBookingsCount: z.number(),
});

const ReviewSummarySchema = z.object({
  id: z.string().uuid(),
  overallRating: z.number(),
  writtenReview: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  actorEmail: z.string().nullable(),
  eventType: z.string().nullable(),
  operation: z.string(),
  tableName: z.string().nullable(),
  createdAt: z.string().datetime(),
});

// ── Per-role payloads ─────────────────────────────────────────

const CommonFieldsSchema = z.object({
  unreadMessages: z.number(),
  unreadNotifications: z.number(),
});

const ParentDashboardSchema = CommonFieldsSchema.extend({
  role: z.literal("PARENT"),
  upcomingBookings: z.array(BookingSummarySchema),
  pendingBookingRequests: z.number(),
  activeDisputes: z.array(DisputeSummarySchema),
  recentPayments: z.array(PaymentSummarySchema),
  studentProfiles: z.array(StudentProfileSummarySchema),
});

const StudentDashboardSchema = CommonFieldsSchema.extend({
  role: z.literal("STUDENT"),
  upcomingLessons: z.array(BookingSummarySchema),
  recentMaterials: z.array(z.object({ id: z.string().uuid(), title: z.string(), uploadedAt: z.string().datetime() })),
  pastSessions: z.array(BookingSummarySchema.extend({ myRating: z.number().nullable() })),
  currentLevelName: z.string().nullable(),
  currentSubjects: z.array(z.string()),
});

const TutorDashboardSchema = CommonFieldsSchema.extend({
  role: z.literal("TUTOR"),
  pendingBookingRequests: z.array(BookingSummarySchema),
  upcomingConfirmedSessions: z.array(BookingSummarySchema),
  earnings: z.object({
    totalEarnedXaf: z.number(),
    pendingEscrowXaf: z.number(),
    balanceXaf: z.number(),
    monthlyEarnedXaf: z.number(),
  }),
  nextPayout: z
    .object({ netAmountXaf: z.number(), status: z.string(), expectedAt: z.string().datetime().nullable() })
    .nullable(),
  kycStatus: z.string().nullable(),
  kycRejectionReason: z.string().nullable(),
  profileCompletionPercent: z.number(),
  recentReviews: z.array(ReviewSummarySchema),
  materialsUploadedCount: z.number(),
});

const AdminDashboardSchema = CommonFieldsSchema.omit({ unreadMessages: true, unreadNotifications: true }).extend({
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
  kycQueue: z.object({ pendingCount: z.number(), oldestPendingAgeHours: z.number().nullable() }),
  openDisputes: z.object({ count: z.number(), oldestUnresolvedAgeHours: z.number().nullable() }),
  flaggedAccounts: z.number(),
  revenue: z.object({ today: z.number(), thisWeek: z.number(), thisMonth: z.number() }),
  escrowBalanceXaf: z.number(),
  pendingPayoutsCount: z.number(),
  newRegistrationsToday: z.record(z.string(), z.number()),
  recentAuditLog: z.array(AuditLogEntrySchema),
  systemHealth: z.object({ database: z.enum(["ok", "down"]), redis: z.enum(["ok", "down"]) }),
  activeSessions: z.number().optional(),
})
  .openapi("AdminDashboard");

export const DashboardResponseSchema = z
  .discriminatedUnion("role", [
    ParentDashboardSchema.openapi("ParentDashboard"),
    StudentDashboardSchema.openapi("StudentDashboard"),
    TutorDashboardSchema.openapi("TutorDashboard"),
  ])
  .or(AdminDashboardSchema);
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

export const DashboardQuerySchema = z.object({
  fresh: z.enum(["true", "false"]).optional(),
});
