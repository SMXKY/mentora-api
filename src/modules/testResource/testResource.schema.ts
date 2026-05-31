import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new TestResource
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreateTestResourceSchema = z
  .object({
  name: z.string(),
  status: z.string().optional(),
  notes: z.string().optional(),
  })
  .openapi("CreateTestResource");

// All fields optional for partial updates
export const UpdateTestResourceSchema = CreateTestResourceSchema.partial().openapi(
  "UpdateTestResource"
);

// Full response shape returned to the client
export const TestResourceResponseSchema = z
  .object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  })
  .openapi("TestResource");
