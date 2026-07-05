import prisma from "../config/database.config";
import { SchoolType } from "../generated/prisma";

// Cameroonian Anglophone-system education levels, in progression order.
// orderIndex is global (not reset per schoolType) so GET /levels returns
// a single, continuous progression from Nursery through Masters.
export const defaultLevels: {
  name: string;
  schoolType: SchoolType;
  orderIndex: number;
}[] = [
  { name: "Nursery 1", schoolType: SchoolType.PRIMARY },
  { name: "Nursery 2", schoolType: SchoolType.PRIMARY },
  { name: "Class 1", schoolType: SchoolType.PRIMARY },
  { name: "Class 2", schoolType: SchoolType.PRIMARY },
  { name: "Class 3", schoolType: SchoolType.PRIMARY },
  { name: "Class 4", schoolType: SchoolType.PRIMARY },
  { name: "Class 5", schoolType: SchoolType.PRIMARY },
  { name: "Class 6", schoolType: SchoolType.PRIMARY },
  { name: "Form 1", schoolType: SchoolType.SECONDARY },
  { name: "Form 2", schoolType: SchoolType.SECONDARY },
  { name: "Form 3", schoolType: SchoolType.SECONDARY },
  { name: "Form 4", schoolType: SchoolType.SECONDARY },
  { name: "Form 5", schoolType: SchoolType.SECONDARY },
  { name: "Lower Sixth", schoolType: SchoolType.GCE },
  { name: "Upper Sixth", schoolType: SchoolType.GCE },
  { name: "University Year 1", schoolType: SchoolType.UNIVERSITY },
  { name: "University Year 2", schoolType: SchoolType.UNIVERSITY },
  { name: "University Year 3", schoolType: SchoolType.UNIVERSITY },
  { name: "University Year 4", schoolType: SchoolType.UNIVERSITY },
  { name: "University Year 5", schoolType: SchoolType.UNIVERSITY },
  { name: "Masters 1", schoolType: SchoolType.UNIVERSITY },
  { name: "Masters 2", schoolType: SchoolType.UNIVERSITY },
].map((level, index) => ({ ...level, orderIndex: index + 1 }));

const seedLevels = async () => {
  console.log("🌱 Seeding levels...");

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const level of defaultLevels) {
      const exists = await tx.level.findUnique({ where: { name: level.name } });
      if (exists) {
        skipped++;
        continue;
      }
      await tx.level.create({ data: level });
      created++;
    }
  });

  console.log(`✅ Levels seeded: ${created} created, ${skipped} skipped`);
};

export default seedLevels;
