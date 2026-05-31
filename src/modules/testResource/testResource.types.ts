import { z } from "zod";
import {
  CreateTestResourceSchema,
  UpdateTestResourceSchema,
  TestResourceResponseSchema,
} from "./testResource.schema";

export type CreateTestResourceInput = z.infer<typeof CreateTestResourceSchema>;
export type UpdateTestResourceInput = z.infer<typeof UpdateTestResourceSchema>;
export type TestResourceResponse = z.infer<typeof TestResourceResponseSchema>;
