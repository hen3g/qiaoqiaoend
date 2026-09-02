import { z } from "zod";

export const QUESTION_TYPES = [
  "zh_to_en",
  "listening",
  "listening_spell",
  "choice",
  "en_to_zh_choice",
  "sentence_translation",
  "sentence_cloze",
  "drag",
] as const;

export type PaperQuestionType = (typeof QUESTION_TYPES)[number];

export const WORD_ONLY_QUESTION_ID = "__word__";

export const QUESTION_TYPE_LABELS: Record<PaperQuestionType, string> = {
  zh_to_en: "看中写英",
  listening: "听音辨词",
  listening_spell: "听音拼写",
  choice: "释义选择",
  en_to_zh_choice: "句中选义",
  sentence_translation: "听句选译",
  sentence_cloze: "句中填空",
  drag: "拖拽组句",
};

export type DragVariantDto = {
  direction: "zh_to_en" | "en_to_zh";
  source: string;
  answerTokens: string[];
  distractorTokens: string[];
};

export type PaperQuestionDto = {
  id: string;
  type: PaperQuestionType;
  prompt: string;
  answer: string;
  translation?: string;
  audioText?: string;
  targetForm?: string;
  options?: string[];
  hints?: string[];
  variants?: DragVariantDto[];
};

export type WordFieldPatch = {
  phonetic?: string;
  meaning?: string;
  partOfSpeech?: string;
  example?: string;
  translation?: string;
};

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

const stringList = (itemMax: number, maxItems: number) =>
  z
    .array(z.string().trim().min(1).max(itemMax))
    .max(maxItems)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const dragVariantSchema = z.object({
  direction: z.enum(["zh_to_en", "en_to_zh"]),
  source: z.string().trim().min(1, "缺少拖拽原句").max(2000),
  answerTokens: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "拖拽答案不能为空")
    .max(40),
  distractorTokens: z.array(z.string().trim().min(1).max(80)).max(40),
});

export const paperQuestionSchema: z.ZodType<PaperQuestionDto> = z
  .object({
    id: z.string().trim().min(1, "缺少题号").max(128),
    type: z.enum(QUESTION_TYPES, { error: "题型无效" }),
    prompt: z.string().trim().min(1, "请填写题目").max(2000),
    answer: z.string().trim().min(1, "请填写答案").max(2000),
    translation: optionalText(2000),
    audioText: optionalText(2000),
    targetForm: optionalText(200),
    options: stringList(500, 16),
    hints: stringList(500, 8),
    variants: z.array(dragVariantSchema).max(4).optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "drag") {
      if (!question.variants || question.variants.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "拖拽题需要填写 variants",
        });
      }
    }
  });

export const wordFieldPatchSchema: z.ZodType<WordFieldPatch> = z.object({
  phonetic: optionalText(128),
  meaning: optionalText(512),
  partOfSpeech: optionalText(64),
  example: optionalText(2000),
  translation: optionalText(2000),
});

export function parseJsonValue<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function compactWordFields(
  fields: WordFieldPatch | null | undefined,
): WordFieldPatch | null {
  if (!fields) return null;
  const next: WordFieldPatch = {};
  if (fields.phonetic) next.phonetic = fields.phonetic;
  if (fields.meaning) next.meaning = fields.meaning;
  if (fields.partOfSpeech) next.partOfSpeech = fields.partOfSpeech;
  if (fields.example) next.example = fields.example;
  if (fields.translation) next.translation = fields.translation;
  return Object.keys(next).length > 0 ? next : null;
}

export function isPaperQuestionType(value: unknown): value is PaperQuestionType {
  return (
    typeof value === "string" &&
    (QUESTION_TYPES as readonly string[]).includes(value)
  );
}
