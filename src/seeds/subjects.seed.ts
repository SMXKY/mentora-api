import prisma from "../config/database.config";

// Domain -> subjects, aligned with what's actually examined in the
// Cameroonian GCE O/A-Level and university-prep curriculum.
export const defaultSubjectsByDomain: Record<string, string[]> = {
  Sciences: [
    "Mathematics",
    "Additional Mathematics",
    "Further Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Computer Science",
  ],
  Languages: [
    "English Language",
    "French Language",
    "Literature in English",
    "Literature in French",
    "Spanish",
    "German",
  ],
  Humanities: [
    "History",
    "Geography",
    "Economics",
    "Citizenship Education",
    "Religious Studies",
    "Government",
  ],
  Commercial: [
    "Accounting",
    "Commerce",
    "Business Mathematics",
    "Marketing",
    "Office Practice",
    "Typewriting",
  ],
  Arts: ["Fine Arts", "Music", "Food Science and Nutrition"],
  "Technical & Vocational": [
    "Technical Drawing",
    "Woodwork",
    "Metalwork",
    "Home Economics",
  ],
};

const seedSubjectDomains = async () => {
  console.log("🌱 Seeding subject domains...");

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const domainName of Object.keys(defaultSubjectsByDomain)) {
      const exists = await tx.subjectDomain.findUnique({
        where: { name: domainName },
      });
      if (exists) {
        skipped++;
        continue;
      }
      await tx.subjectDomain.create({ data: { name: domainName } });
      created++;
    }
  });

  console.log(
    `✅ Subject domains seeded: ${created} created, ${skipped} skipped`
  );
};

const seedSubjects = async () => {
  console.log("🌱 Seeding subjects...");

  let created = 0;
  let skipped = 0;
  let domainsMissing = 0;

  for (const [domainName, subjectNames] of Object.entries(
    defaultSubjectsByDomain
  )) {
    const domain = await prisma.subjectDomain.findUnique({
      where: { name: domainName },
    });
    if (!domain) {
      domainsMissing++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      for (const subjectName of subjectNames) {
        const exists = await tx.subject.findFirst({
          where: { name: subjectName, domainId: domain.id },
        });
        if (exists) {
          skipped++;
          continue;
        }
        await tx.subject.create({
          data: { name: subjectName, domainId: domain.id },
        });
        created++;
      }
    });
  }

  console.log(
    `✅ Subjects seeded: ${created} created, ${skipped} skipped` +
      (domainsMissing > 0 ? `, ${domainsMissing} domain(s) not found` : "")
  );
};

export { seedSubjectDomains, seedSubjects };
