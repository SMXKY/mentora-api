import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const SelfRegisterableRole = z.enum(["Parent", "Student", "Tutor"]);

export const CompleteRegistrationSchema = z
  .object({
    role: SelfRegisterableRole,
  })
  .openapi("CompleteRegistration");

export type CompleteRegistrationInput = z.infer<
  typeof CompleteRegistrationSchema
>;

export const SessionStatusResponseSchema = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("needs_registration"),
    }),
    z.object({
      status: z.literal("ready"),
      user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        isEmailVerified: z.boolean(),
        isAccountComplete: z.boolean(),
        preferredLanguage: z.enum(["EN", "FR"]),
        role: z.string(),
      }),
    }),
  ])
  .openapi("SessionStatus");

export type SessionStatusResponse = z.infer<typeof SessionStatusResponseSchema>;
