import { Prisma } from "../generated/prisma";

export function serializeData<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (data instanceof Prisma.Decimal) {
    return Number(data) as unknown as T;
  }

  if (typeof data === "bigint") {
    return data.toString() as unknown as T;
  }

  if (data instanceof Date) return data;

  if (Array.isArray(data)) {
    return data.map(serializeData) as unknown as T;
  }

  if (typeof data === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeData(value);
    }
    return result as T;
  }

  return data;
}

export default serializeData;
