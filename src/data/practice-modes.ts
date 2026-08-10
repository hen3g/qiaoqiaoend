/** 自制课程练习模式 */

export type PracticeMode =
  | "progressive"
  | "sentences"
  | "dialogue"
  | "article";

/** 单词来源下可选的练习模式（不含文章模式；文章是并列输入方式） */
export const PRACTICE_MODES = [
  {
    id: "progressive" as const,
    label: "循序渐进",
    hint: "先单词，再短语，再句子",
  },
  {
    id: "sentences" as const,
    label: "全造句",
    hint: "只用目标词造句，不练单词卡",
  },
  {
    id: "dialogue" as const,
    label: "情景对话",
    hint: "多轮 A/B 对话，练场景表达",
  },
] as const;

export const PRACTICE_MODE_IDS = new Set<string>([
  ...PRACTICE_MODES.map((m) => m.id),
  "article",
]);

export function isPracticeMode(value: unknown): value is PracticeMode {
  return typeof value === "string" && PRACTICE_MODE_IDS.has(value);
}

export function practiceModeLabel(mode: PracticeMode | undefined): string {
  if (mode === "article") return "文章模式";
  const found = PRACTICE_MODES.find((m) => m.id === (mode ?? "progressive"));
  return found?.label ?? "循序渐进";
}
