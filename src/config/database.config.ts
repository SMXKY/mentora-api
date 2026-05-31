import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function patchDecimalSerialization() {
  const result = await prisma.$queryRaw`SELECT 1.0::decimal as val`;
  const DecimalProto = Object.getPrototypeOf((result as any)[0].val);
  DecimalProto.toJSON = function () {
    return this.toString();
  };
}

patchDecimalSerialization().catch(console.error);

export default prisma;
