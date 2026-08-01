import prisma from "../../config/database.config";
import { ConfigCategory } from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";

export interface ConfigKeySpec<T = any> {
  key: string;
  category: ConfigCategory;
  description: string;
  default: T;
}

type SpecMap = Record<string, ConfigKeySpec>;
type ValuesOf<T extends SpecMap> = { [K in keyof T]: T[K]["default"] };

/**
 * Generic admin-configurable settings group backed by PlatformConfig
 * single-key rows — mirrors the pattern already used by kycAdmin's SLA
 * config and introVideoPolicy, generalised so each new module (booking,
 * payment, dispute) doesn't re-implement the same upsert boilerplate.
 */
export function createConfigGroup<T extends SpecMap>(specs: T) {
  async function getAll(): Promise<ValuesOf<T>> {
    const keys = Object.values(specs).map((s) => s.key);
    const rows = await prisma.platformConfig.findMany({
      where: { key: { in: keys } },
    });
    const result = {} as ValuesOf<T>;
    for (const name of Object.keys(specs) as (keyof T)[]) {
      const spec = specs[name];
      const row = rows.find((r) => r.key === spec.key);
      result[name] = (row ? (row.value as T[typeof name]["default"]) : spec.default);
    }
    return result;
  }

  async function updateMany(
    values: Partial<ValuesOf<T>>,
    ctx: ServiceContext
  ): Promise<ValuesOf<T>> {
    const entries = Object.entries(values).filter(([, v]) => v !== undefined);
    await Promise.all(
      entries.map(([name, value]) => {
        const spec = specs[name as keyof T];
        return prisma.platformConfig.upsert({
          where: { key: spec.key },
          create: {
            key: spec.key,
            value: value as any,
            category: spec.category,
            description: spec.description,
            defaultValue: spec.default as any,
            updatedById: ctx.userId!,
          },
          update: { value: value as any, updatedById: ctx.userId! },
        });
      })
    );
    return getAll();
  }

  async function getOne<K extends keyof T>(name: K): Promise<T[K]["default"]> {
    const spec = specs[name];
    const row = await prisma.platformConfig.findUnique({ where: { key: spec.key } });
    return row ? (row.value as T[K]["default"]) : spec.default;
  }

  return { specs, getAll, updateMany, getOne };
}
