import "dotenv/config";
import fs from "fs";
import path from "path";
import prisma from "../src/config/database.config";

// Dry run only. Reads the current Subject table and prints what Part 1/2
// of the subject restructuring plan WOULD do, writes nothing to the
// database. The real migration script reuses this same logic once the
// report here is approved.

type ExamLevel = "GCE_A_LEVEL" | "GCE_O_LEVEL" | "TVE_INTERMEDIATE" | "NONE";

const EXAM_LEVEL_PATTERNS: [RegExp, ExamLevel][] = [
  [/\s*\(GCE A Level\)\s*$/i, "GCE_A_LEVEL"],
  [/\s*\(GCE O Level\)\s*$/i, "GCE_O_LEVEL"],
  [/\s*\(TVE Intermediate Level\)\s*$/i, "TVE_INTERMEDIATE"],
];

function splitExamLevel(name: string): { baseName: string; examLevel: ExamLevel } {
  for (const [pattern, level] of EXAM_LEVEL_PATTERNS) {
    if (pattern.test(name)) {
      return { baseName: name.replace(pattern, "").trim(), examLevel: level };
    }
  }
  return { baseName: name.trim(), examLevel: "NONE" };
}

const SERIES_DOMAINS = new Set(["Specialty / Series", "Series / Track"]);

// Approved one-off: stays in Technical & Vocational (moving domains would
// touch categorization for no real benefit, and it has zero
// TutorSubject references either way), just excluded from translation.
const ISSERIESCODE_NAME_OVERRIDES = new Set(["Surveying SURV"]);

const DELETE_CANDIDATE_NAMES = [
  ") of the ERASMUS+ Programme (2026-2027)",
  "Business, Accounting & Economics",
  "Languages & Literature",
  "Science",
  "Technical & Vocational",
  "Technology & ICT",
];

async function main() {
  const report: Record<string, unknown> = {};

  // ---- Deletion candidates ----
  const deletions: any[] = [];
  const blockedDeletions: any[] = [];
  for (const name of DELETE_CANDIDATE_NAMES) {
    const rows = await prisma.subject.findMany({
      where: { name },
      include: { domain: { select: { name: true } } },
    });
    for (const row of rows) {
      const refs = await prisma.tutorSubject.count({ where: { subjectId: row.id } });
      const entry = { id: row.id, name: row.name, domain: row.domain.name, tutorSubjectRefs: refs };
      if (refs > 0) blockedDeletions.push(entry);
      else deletions.push(entry);
    }
  }
  report.deletionCandidates = deletions;
  report.blockedDeletions = blockedDeletions;

  // ---- Everything else, excluding deletion candidates ----
  const deleteIds = new Set(deletions.map((d) => d.id));
  const allSubjects = await prisma.subject.findMany({
    include: { domain: { select: { name: true } } },
  });
  const remaining = allSubjects.filter((s) => !deleteIds.has(s.id));

  const splitResults = remaining.map((s) => {
    const isSeriesCode = SERIES_DOMAINS.has(s.domain.name) || ISSERIESCODE_NAME_OVERRIDES.has(s.name);
    const { baseName, examLevel } = splitExamLevel(s.name);
    return {
      id: s.id,
      originalName: s.name,
      domain: s.domain.name,
      domainId: s.domainId,
      baseName,
      examLevel,
      isSeriesCode,
    };
  });

  // ---- Casing collisions: same (domainId, lowercase baseName), different actual casing ----
  const groups = new Map<string, typeof splitResults>();
  for (const r of splitResults) {
    if (r.isSeriesCode) continue; // series codes are exact-match, casing is intentional
    const key = `${r.domainId}::${r.baseName.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const casingCollisions: any[] = [];
  for (const [, group] of groups) {
    const distinctCasings = new Set(group.map((g) => g.baseName));
    if (distinctCasings.size <= 1) continue;

    const canonicalRow =
      group.find((g) => g.examLevel === "NONE") ??
      [...group].sort((a, b) => b.baseName.length - a.baseName.length)[0];

    casingCollisions.push({
      domain: group[0].domain,
      variants: group.map((g) => ({ id: g.id, baseName: g.baseName, examLevel: g.examLevel })),
      canonicalBaseName: canonicalRow.baseName,
      canonicalChosenFrom: canonicalRow.id,
    });
  }
  report.casingCollisions = casingCollisions;

  // Apply canonical casing into the split results for the summary/full report
  for (const collision of casingCollisions) {
    for (const variant of collision.variants) {
      const row = splitResults.find((r) => r.id === variant.id);
      if (row) (row as any).canonicalBaseName = collision.canonicalBaseName;
    }
  }

  // ---- Summary counts ----
  const examLevelCounts: Record<string, number> = {};
  let seriesCodeCount = 0;
  for (const r of splitResults) {
    examLevelCounts[r.examLevel] = (examLevelCounts[r.examLevel] ?? 0) + 1;
    if (r.isSeriesCode) seriesCodeCount++;
  }
  report.summary = {
    totalSubjectsExamined: allSubjects.length,
    deletionCandidateCount: deletions.length,
    blockedDeletionCount: blockedDeletions.length,
    remainingAfterDeletions: remaining.length,
    examLevelCounts,
    seriesCodeCount,
    casingCollisionGroups: casingCollisions.length,
  };

  report.fullSplitResults = splitResults;

  // ---- Output ----
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(report.summary, null, 2));

  console.log("\n=== DELETION CANDIDATES (0 TutorSubject refs, safe) ===");
  console.log(JSON.stringify(deletions, null, 2));

  if (blockedDeletions.length > 0) {
    console.log("\n=== BLOCKED DELETIONS (has TutorSubject refs, NOT deleting) ===");
    console.log(JSON.stringify(blockedDeletions, null, 2));
  }

  console.log("\n=== CASING COLLISIONS ===");
  console.log(JSON.stringify(casingCollisions, null, 2));

  console.log(`\n=== SERIES-CODE SUBJECTS (${seriesCodeCount}, excluded from translation) ===`);
  console.log(
    JSON.stringify(
      splitResults.filter((r) => r.isSeriesCode).map((r) => ({ id: r.id, name: r.originalName, domain: r.domain })),
      null,
      2
    )
  );

  const outPath = path.join(process.cwd(), "dry-run-subject-restructure-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report (all ${remaining.length} rows' baseName/examLevel) written to: ${outPath}`);
}

main()
  .catch((err) => {
    console.error("Dry run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
