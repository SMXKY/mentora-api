import { z } from "zod";

export const ListCitiesQuery = z.object({
  regionId: z.string().uuid().optional(),
});

export const ListSubjectsQuery = z.object({
  domainId: z.string().uuid().optional(),
  search: z.string().min(1).max(100).optional(),
});

export const ListLevelsQuery = z.object({
  schoolType: z.enum(["PRIMARY", "SECONDARY", "GCE", "UNIVERSITY", "OTHER"]).optional(),
});
