import prisma from "../../config/database.config";

export interface CompletionItem {
  /** Stable machine-readable key the client uses to route to the right form. */
  key: string;
  /** i18n key for the human-readable label of this requirement. */
  labelCode: string;
  complete: boolean;
}

export interface CompletionResult {
  /**
   * REQ-006-014 models completion_status as an enum of "incomplete" |
   * "complete". Rather than a redundant second column, this is derived
   * from the existing `User.isAccountComplete` boolean (kept in sync by
   * this evaluator) — one source of truth, two representations.
   */
  completionStatus: "complete" | "incomplete";
  isComplete: boolean;
  role: string | null;
  percent: number;
  items: CompletionItem[];
  missing: string[];
}

/**
 * Roles with no consumer-facing completion requirement (Admin, Moderator,
 * Support Agent, ...) are always treated as complete — completion gating
 * only applies to Parent/Student/Tutor marketplace participants.
 */
const GATED_ROLES = new Set(["Parent", "Student", "Tutor"]);

/**
 * Evaluates and persists completion state for a user, returning exactly
 * which requirements are still missing. Tutor "full profile" is broken
 * into its constituent parts (subjects, pricing, photo) rather than a
 * single pass/fail flag — bio/location/mode are schema-required on
 * TutorProfile itself, so once that row exists those three are guaranteed
 * satisfied and don't need their own checks.
 */
export async function evaluateCompletion(
  userId: string
): Promise<CompletionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isEmailVerified: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      userRoles: {
        where: { isActive: true },
        select: { role: { select: { name: true } } },
      },
    },
  });

  if (!user) {
    return {
      completionStatus: "incomplete",
      isComplete: false,
      role: null,
      percent: 0,
      items: [],
      missing: [],
    };
  }

  const role = user.userRoles[0]?.role.name ?? null;

  const items: CompletionItem[] = [
    {
      key: "email_verified",
      labelCode: "account_completion/items:email_verified",
      complete: user.isEmailVerified,
    },
    {
      key: "full_name",
      labelCode: "account_completion/items:full_name",
      complete: !!(user.firstName && user.lastName),
    },
    {
      key: "phone_number",
      labelCode: "account_completion/items:phone_number",
      complete: !!user.phoneNumber,
    },
  ];

  if (role === "Parent") {
    const studentCount = await prisma.studentProfile.count({
      where: { guardianId: userId, deletedAt: null },
    });
    items.push({
      key: "student_profile",
      labelCode: "account_completion/items:student_profile",
      complete: studentCount > 0,
    });
  } else if (role === "Student") {
    const profile = await prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { levelId: true, subjects: { select: { id: true }, take: 1 } },
    });
    items.push({
      key: "class_level",
      labelCode: "account_completion/items:class_level",
      complete: !!profile?.levelId,
    });
    items.push({
      key: "subject_of_interest",
      labelCode: "account_completion/items:subject_of_interest",
      complete: (profile?.subjects.length ?? 0) > 0,
    });
  } else if (role === "Tutor") {
    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { minRateXaf: true, maxRateXaf: true, profilePictureUrl: true },
    });
    // bio, teachingMode, and cityId are NOT NULL on TutorProfile, so a row
    // existing at all already satisfies "information/bio/location/mode".
    // Subjects are deliberately NOT a completion requirement here — a
    // tutor only ever claims subjects by going through KYC (Module 9),
    // and KYC itself is gated behind this completion check. Requiring
    // subjects first would make it impossible for any tutor to ever
    // reach 100% and unlock verification.
    items.push({
      key: "tutor_profile",
      labelCode: "account_completion/items:tutor_profile",
      complete: !!profile,
    });
    items.push({
      key: "pricing",
      labelCode: "account_completion/items:pricing",
      complete: !!(profile?.minRateXaf && profile?.maxRateXaf),
    });
    items.push({
      key: "photo",
      labelCode: "account_completion/items:photo",
      complete: !!profile?.profilePictureUrl,
    });
  }

  const missing = items.filter((i) => !i.complete).map((i) => i.key);
  // Ungated roles (Admin, etc.) are complete by definition regardless of items.
  const isComplete = !GATED_ROLES.has(role ?? "") || missing.length === 0;
  const percent =
    items.length === 0
      ? 100
      : Math.round(
          (items.filter((i) => i.complete).length / items.length) * 100
        );

  await prisma.user
    .update({ where: { id: userId }, data: { isAccountComplete: isComplete } })
    .catch(() => {});

  return {
    completionStatus: isComplete ? "complete" : "incomplete",
    isComplete,
    role,
    percent,
    items,
    missing: isComplete ? [] : missing,
  };
}
