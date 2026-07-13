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
    "Agricultural Science",
    "Human Biology",
    "Environmental Science",
    "General Science",
  ],
  Languages: [
    "English Language",
    "French Language",
    "Literature in English",
    "Literature in French",
    "Spanish",
    "German",
    "Portuguese",
    "Arabic",
    "Latin",
    "Chinese",
  ],
  Humanities: [
    "History",
    "Geography",
    "Economics",
    "Citizenship Education",
    "Religious Studies",
    "Government",
    "Social Studies",
    "Philosophy",
    "Logic",
    "Moral Education",
  ],
  Commercial: [
    "Accounting",
    "Commerce",
    "Business Mathematics",
    "Marketing",
    "Office Practice",
    "Typewriting",
    "Shorthand",
    "Insurance",
    "Entrepreneurship",
    "Principles of Business",
  ],
  Arts: [
    "Fine Arts",
    "Music",
    "Food Science and Nutrition",
    "Drama and Theatre Arts",
    "Dance",
  ],
  "Technical & Vocational": [
    "Technical Drawing",
    "Woodwork",
    "Metalwork",
    "Home Economics",
    "Building Construction",
    "Electrical Installation",
    "Automobile Engineering",
    "Agriculture",
    "Textiles and Fashion Design",
    "Information and Communication Technology",
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
