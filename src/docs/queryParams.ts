import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const PaginationParams = z.object({
  page: z
    .string()
    .openapi({
      description: "Page number (default: 1)",
      example: "1",
    })
    .optional(),

  limit: z
    .string()
    .openapi({
      description: "Number of results per page (default: 10, max: 100)",
      example: "20",
    })
    .optional(),
});

export const SortParams = z.object({
  sort: z.string().optional().openapi({
    description:
      "Sort fields as comma-separated list. Prefix with - for descending. Example: -createdAt,name sorts by createdAt descending then name ascending",
    example: "-createdAt,name",
  }),
});

export const FieldsParams = z.object({
  fields: z.string().optional().openapi({
    description:
      "Comma-separated list of fields to include in response. Example: id,name,createdAt",
    example: "id,name,createdAt",
  }),
});

export const FilterParams = z.object({
  // Generic filter documentation — specific endpoints add their own field filters
  "[field]": z.string().optional().openapi({
    description:
      "Filter by any field. Use object notation for operators: [field][gt]=10, [field][lt]=100, [field][in]=a,b,c. Supported operators: gt, gte, lt, lte, ne, in, nin",
    example: "status=active",
  }),
});

// Combine all into one object for routes that support everything
export const FullQueryParams =
  PaginationParams.merge(SortParams).merge(FieldsParams);
