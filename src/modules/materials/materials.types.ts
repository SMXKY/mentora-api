import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 8.5 — Learning Materials — zod schemas & inferred types
// ============================================================

// ── Collections ──────────────────────────────────────────────
export const CollectionCreateSchema = z
  .object({
    name: z.string().min(1, "materials/errors:fieldRequired").max(255),
    description: z.string().max(2000).optional(),
    subjectId: z.string().uuid("common/errors:validation.invalidFormat"),
    levelId: z.string().uuid("common/errors:validation.invalidFormat"),
  })
  .openapi("MaterialsCollectionCreate");
export type CollectionCreateInput = z.infer<typeof CollectionCreateSchema>;

export const CollectionUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .openapi("MaterialsCollectionUpdate");
export type CollectionUpdateInput = z.infer<typeof CollectionUpdateSchema>;

export const CollectionListQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1).max(100)),
    subjectId: z.string().uuid().optional(),
    search: z.string().trim().min(1).optional(),
  })
  .openapi("MaterialsCollectionListQuery");
export type CollectionListQueryInput = z.infer<typeof CollectionListQuerySchema>;

// ── Sections ─────────────────────────────────────────────────
export const SectionCreateSchema = z
  .object({
    name: z.string().min(1, "materials/errors:fieldRequired").max(255),
    description: z.string().max(255).optional(),
    isFreePreview: z.boolean().optional().default(false),
  })
  .openapi("MaterialsSectionCreate");
export type SectionCreateInput = z.infer<typeof SectionCreateSchema>;

export const SectionUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(255).nullable().optional(),
    isFreePreview: z.boolean().optional(),
  })
  .openapi("MaterialsSectionUpdate");
export type SectionUpdateInput = z.infer<typeof SectionUpdateSchema>;

// ── Generic drag-and-drop reorder ───────────────────────────
export const ReorderSchema = z
  .object({
    orderedIds: z
      .array(z.string().uuid())
      .min(1, "materials/errors:reorderListEmpty"),
  })
  .openapi("MaterialsReorder");
export type ReorderInput = z.infer<typeof ReorderSchema>;

// ── Materials ────────────────────────────────────────────────
// WRITTEN_NOTE is deliberately excluded here — it has its own
// no-file creation endpoint/schema below.
export const FileBackedMaterialTypeEnum = z.enum([
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "IMAGE",
]);

export const MaterialCreateSchema = z
  .object({
    name: z.string().min(1, "materials/errors:fieldRequired").max(255),
    materialType: FileBackedMaterialTypeEnum,
    sectionId: z.string().uuid().optional(),
    // Multipart text fields arrive as strings — z.coerce.boolean() would
    // treat "false" as truthy (Boolean("false") === true), so this maps
    // the literal string values explicitly instead.
    isFreePreview: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform((v) => v === "true"),
  })
  .openapi("MaterialsMaterialCreate");
export type MaterialCreateInput = z.infer<typeof MaterialCreateSchema>;

export const WrittenNoteCreateSchema = z
  .object({
    name: z.string().min(1, "materials/errors:fieldRequired").max(255),
    sectionId: z.string().uuid().optional(),
    isFreePreview: z.boolean().optional().default(false),
    contentJson: z.any(), // structurally validated by TipTapDocSchema in the service
  })
  .openapi("MaterialsWrittenNoteCreate");
export type WrittenNoteCreateInput = z.infer<typeof WrittenNoteCreateSchema>;

export const MaterialUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    sectionId: z.string().uuid().nullable().optional(),
    isFreePreview: z.boolean().optional(),
  })
  .openapi("MaterialsMaterialUpdate");
export type MaterialUpdateInput = z.infer<typeof MaterialUpdateSchema>;

export const WrittenNoteContentUpdateSchema = z
  .object({
    contentJson: z.any(),
  })
  .openapi("MaterialsWrittenNoteContentUpdate");
export type WrittenNoteContentUpdateInput = z.infer<
  typeof WrittenNoteContentUpdateSchema
>;

// ── TipTap structural validation ────────────────────────────
// Written-note content is stored as structured JSON, never raw HTML.
// This is a structural allowlist, not a full TipTap schema — it exists
// to reject anything that isn't a well-formed doc tree (unknown/raw-html
// node types, unbounded nesting) before it ever reaches the database or
// a renderer, per the "sanitized before storage and before rendering"
// requirement.
const ALLOWED_TIPTAP_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
  "codeBlock",
  "hardBreak",
  "blockquote",
  "horizontalRule",
  "inlineMath",
  "blockMath",
]);

const TipTapMarkSchema = z
  .object({
    type: z.string(),
    attrs: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export const TipTapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      type: z
        .string()
        .refine((t) => ALLOWED_TIPTAP_NODE_TYPES.has(t), {
          message: "materials/errors:invalidTipTapContent",
        }),
      attrs: z.record(z.string(), z.any()).optional(),
      marks: z.array(TipTapMarkSchema).max(20).optional(),
      text: z.string().max(20000).optional(),
      content: z.array(TipTapNodeSchema).max(2000).optional(),
    })
    .strict()
);

export const TipTapDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(TipTapNodeSchema).max(2000),
  })
  .strict()
  .openapi("MaterialsTipTapDoc");

// ── Lesson Plans ─────────────────────────────────────────────
export const LessonPlanCreateSchema = z
  .object({
    title: z.string().min(1, "materials/errors:fieldRequired").max(255),
    description: z.string().max(2000).optional(),
  })
  .openapi("MaterialsLessonPlanCreate");
export type LessonPlanCreateInput = z.infer<typeof LessonPlanCreateSchema>;

export const LessonPlanUpdateSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .openapi("MaterialsLessonPlanUpdate");
export type LessonPlanUpdateInput = z.infer<typeof LessonPlanUpdateSchema>;

export const LessonPlanTopicCreateSchema = z
  .object({
    title: z.string().min(1, "materials/errors:fieldRequired").max(255),
    description: z.string().max(2000).optional(),
    sectionId: z.string().uuid().optional(),
  })
  .openapi("MaterialsLessonPlanTopicCreate");
export type LessonPlanTopicCreateInput = z.infer<
  typeof LessonPlanTopicCreateSchema
>;

export const LessonPlanTopicUpdateSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    sectionId: z.string().uuid().nullable().optional(),
  })
  .openapi("MaterialsLessonPlanTopicUpdate");
export type LessonPlanTopicUpdateInput = z.infer<
  typeof LessonPlanTopicUpdateSchema
>;

// ── Admin: downloadability policy (PlatformConfig-backed) ───
export const DownloadPolicyUpdateSchema = z
  .object({
    VIDEO: z.boolean().optional(),
    AUDIO: z.boolean().optional(),
    DOCUMENT: z.boolean().optional(),
    IMAGE: z.boolean().optional(),
  })
  .openapi("MaterialsDownloadPolicyUpdate");
export type DownloadPolicyUpdateInput = z.infer<
  typeof DownloadPolicyUpdateSchema
>;

export const DownloadPolicyResponseSchema = z
  .object({
    VIDEO: z.boolean(),
    AUDIO: z.boolean(),
    DOCUMENT: z.boolean(),
    IMAGE: z.boolean(),
  })
  .openapi("MaterialsDownloadPolicyResponse");
export type DownloadPolicyResponse = z.infer<
  typeof DownloadPolicyResponseSchema
>;

// ── Admin: moderation ────────────────────────────────────────
export const ModerationReasonCodeEnum = z.enum([
  "POLICY_VIOLATION",
  "COPYRIGHT",
  "INAPPROPRIATE_CONTENT",
  "OTHER",
]);

export const ModerationRemoveSchema = z
  .object({
    reasonCode: ModerationReasonCodeEnum,
    reviewNote: z.string().min(1, "materials/errors:fieldRequired").max(2000),
  })
  .openapi("MaterialsModerationRemove");
export type ModerationRemoveInput = z.infer<typeof ModerationRemoveSchema>;

export const CollectionSuspendSchema = z
  .object({
    reasonCode: ModerationReasonCodeEnum,
    reviewNote: z.string().min(1, "materials/errors:fieldRequired").max(2000),
  })
  .openapi("MaterialsCollectionSuspend");
export type CollectionSuspendInput = z.infer<typeof CollectionSuspendSchema>;
