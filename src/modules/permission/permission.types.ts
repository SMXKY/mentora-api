import { z } from "zod";
import {
  CreatePermissionSchema,
  UpdatePermissionSchema,
  PermissionResponseSchema,
} from "./permission.schema";

export type CreatePermissionInput = z.infer<typeof CreatePermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof UpdatePermissionSchema>;
export type PermissionResponse = z.infer<typeof PermissionResponseSchema>;
