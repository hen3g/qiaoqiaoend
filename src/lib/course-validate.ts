import type {
  CourseDifficulty,
  CourseLesson,
  CoursePack,
  CourseSentence,
  CourseSentenceToken,
  CourseWord,
  PracticeMode,
  TokenPos,
  TokenRole,
} from "@/data/course-types";
import { isPracticeMode } from "@/data/practice-modes";
import { normalizeSentenceDialogue } from "@/lib/dialogue-line";
import { extractJsonText, parseJsonWithRepair } from "@/lib/parse-ai-json";

export { extractJsonText };

const LEVELS = new Set(["word", "phrase", "sentence"]);

const TOKEN_POS = new Set<TokenPos>([
  "感叹词",
  "代词",
  "动词",
  "系动词",
  "助动词",
  "名词",
  "形容词",
  "副词",
  "冠词",
  "限定词",
  "介词",
  "连词",
  "数词",
  "疑问词",
]);

const TOKEN_ROLES = new Set<TokenRole>([
  "word",
  "subject",
  "predicate",
  "object",
  "attributive",
  "adverbial",
  "complement",
  "vocative",
  "head",
]);

/** AI 常误用的 role → 规范值 */
const ROLE_ALIASES: Record<string, TokenRole> = {
  word: "word",
  subject: "subject",
  predicate: "predicate",
  object: "object",
  attributive: "attributive",
  adverbial: "adverbial",
  complement: "complement",
  vocative: "vocative",
  head: "head",
  // 旧版 / 英文语法术语
  verb: "predicate",
  predicateverb: "predicate",
  "predicate verb": "predicate",
  pred: "predicate",
  subj: "subject",
  obj: "object",
  modifier: "attributive",
  modify: "attributive",
  determiner: "attributive",
  det: "attributive",
  article: "attributive",
  adj: "attributive",
  adjective: "attributive",
  adv: "adverbial",
  adverb: "adverbial",
  prep: "adverbial",
  preposition: "adverbial",
  prepositional: "adverbial",
  aux: "predicate",
  auxiliary: "predicate",
  linking: "predicate",
  copula: "predicate",
  predicative: "complement",
  "subject complement": "complement",
  "object complement": "complement",
  noun: "head",
  "noun head": "head",
  center: "head",
  nucleus: "head",
  greeting: "word",
  interjection: "word",
  particle: "word",
  conjunction: "word",
  connector: "word",
  onomatopoeia: "word",
  "infinitive-marker": "word",
  "infinitive marker": "word",
  infinitive: "word",
  // 中文
  单词: "word",
  主语: "subject",
  谓语: "predicate",
  宾语: "object",
  定语: "attributive",
  状语: "adverbial",
  补语: "complement",
  表语: "complement",
  称呼: "vocative",
  称呼语: "vocative",
  中心语: "head",
  中心词: "head",
  限定词: "attributive",
  修饰语: "attributive",
};

/** AI 常误用的 pos → 规范值 */
const POS_ALIASES: Record<string, TokenPos> = {
  感叹词: "感叹词",
  代词: "代词",
  动词: "动词",
  系动词: "系动词",
  助动词: "助动词",
  名词: "名词",
  形容词: "形容词",
  副词: "副词",
  冠词: "冠词",
  限定词: "限定词",
  介词: "介词",
  连词: "连词",
  数词: "数词",
  疑问词: "疑问词",
  // 英文
  interjection: "感叹词",
  int: "感叹词",
  pronoun: "代词",
  pron: "代词",
  verb: "动词",
  v: "动词",
  "linking verb": "系动词",
  "link verb": "系动词",
  系词: "系动词",
  be动词: "系动词",
  auxiliary: "助动词",
  aux: "助动词",
  modal: "助动词",
  "modal verb": "助动词",
  情态动词: "助动词",
  情态: "助动词",
  助动: "助动词",
  noun: "名词",
  n: "名词",
  adjective: "形容词",
  adj: "形容词",
  adverb: "副词",
  adv: "副词",
  article: "冠词",
  art: "冠词",
  determiner: "限定词",
  det: "限定词",
  物主代词: "限定词",
  指示代词: "限定词",
  preposition: "介词",
  prep: "介词",
  conjunction: "连词",
  conj: "连词",
  numeral: "数词",
  number: "数词",
  interrogative: "疑问词",
  wh: "疑问词",
  疑问代词: "疑问词",
  疑问副词: "疑问词",
  // AI / 课程修正常见非规范词性
  拟声词: "感叹词",
  onomatopoeia: "感叹词",
  不定式符号: "介词",
  不定式标记: "介词",
  "infinitive marker": "介词",
  "infinitive-marker": "介词",
  to: "介词",
};

function normalizeTokenRole(raw: string): TokenRole | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (TOKEN_ROLES.has(raw.trim() as TokenRole)) {
    return raw.trim() as TokenRole;
  }
  const mapped = ROLE_ALIASES[key] ?? ROLE_ALIASES[raw.trim()];
  return mapped ?? null;
}

function normalizeTokenPos(raw: string): TokenPos | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (TOKEN_POS.has(trimmed as TokenPos)) return trimmed as TokenPos;
  const key = trimmed.toLowerCase();
  return POS_ALIASES[key] ?? POS_ALIASES[trimmed] ?? null;
}

export function parseAndValidateCourse(raw: string): CoursePack {
  let data: unknown;
  try {
    data = parseJsonWithRepair(raw);
  } catch {
    throw new Error("AI 返回的内容不是有效 JSON，请重试。");
  }
  return validateCoursePack(data);
}

export function validateCoursePack(data: unknown): CoursePack {
  if (!data || typeof data !== "object") {
    throw new Error("课程数据格式错误。");
  }
  const p = data as Record<string, unknown>;

  const id = normalizeCourseId(String(p.id ?? p.title ?? "user-course"));
  const title = String(p.title ?? "").trim();
  if (!title) throw new Error("课程缺少标题。");

  const seriesId = String(p.seriesId ?? "").trim();
  const seriesOrderRaw = Number(p.seriesOrder);
  const seriesOrder =
    Number.isFinite(seriesOrderRaw) && seriesOrderRaw > 0
      ? Math.round(seriesOrderRaw)
      : undefined;
  const description = String(p.description ?? "").trim() || "自制课程";
  const difficulty = clampDifficulty(p.difficulty);
  const durationMinutes = Math.max(
    1,
    Math.round(Number(p.durationMinutes) || 15),
  );

  if (!Array.isArray(p.lessons) || p.lessons.length === 0) {
    throw new Error("课程至少需要一课。");
  }

  const lessons = p.lessons.map((lesson, i) =>
    validateLesson(lesson, i),
  );

  const practiceMode: PracticeMode | undefined = isPracticeMode(p.practiceMode)
    ? p.practiceMode
    : undefined;

  const stageRaw = p.stage;
  let stage: string | number | undefined;
  if (stageRaw !== undefined && stageRaw !== null && stageRaw !== "") {
    const asString = String(stageRaw).trim();
    if (!/^\d+(\.\d+)*$/.test(asString)) {
      throw new Error(
        '课程 stage 格式无效，应为 "100"、"200"、"200.1" 这类分段编号。',
      );
    }
    stage = asString;
  }

  return {
    id,
    ...(seriesId ? { seriesId } : {}),
    ...(seriesOrder ? { seriesOrder } : {}),
    title,
    description,
    difficulty,
    durationMinutes,
    ...(stage !== undefined ? { stage } : {}),
    ...(practiceMode ? { practiceMode } : {}),
    ...(typeof p.audioReady === "boolean" ? { audioReady: p.audioReady } : {}),
    ...(typeof p.authorUserId === "number" && Number.isFinite(p.authorUserId)
      ? { authorUserId: Math.round(p.authorUserId) }
      : {}),
    ...(typeof p.authorName === "string" && p.authorName.trim()
      ? { authorName: p.authorName.trim().slice(0, 64) }
      : {}),
    ...(typeof p.sourceCourseKey === "string" && p.sourceCourseKey.trim()
      ? { sourceCourseKey: p.sourceCourseKey.trim().slice(0, 192) }
      : {}),
    lessons,
  };
}

function validateLesson(data: unknown, index: number): CourseLesson {
  if (!data || typeof data !== "object") {
    throw new Error(`第 ${index + 1} 课格式错误。`);
  }
  const l = data as Record<string, unknown>;
  const id = String(l.id ?? `lesson-${index + 1}`).trim() || `lesson-${index + 1}`;
  const title = String(l.title ?? `第 ${index + 1} 课`).trim();

  if (!Array.isArray(l.sentences) || l.sentences.length === 0) {
    throw new Error(`「${title}」至少需要一道练习。`);
  }

  // 单词为可选项：对话类课程可以没有单词卡，仅由句子（对话）构成。
  const words = Array.isArray(l.words)
    ? l.words.map((w, i) => validateWord(w, i))
    : [];
  const sentences = l.sentences.map((s, i) => validateSentence(s, i));

  return { id, title, words, sentences };
}

function validateWord(data: unknown, index: number): CourseWord {
  if (!data || typeof data !== "object") {
    throw new Error(`单词 #${index + 1} 格式错误。`);
  }
  const w = data as Record<string, unknown>;
  const en = String(w.en ?? "").trim();
  if (!en) throw new Error(`单词 #${index + 1} 缺少英文。`);
  const id = String(w.id ?? en).trim() || en;
  return {
    id,
    en,
    zh: String(w.zh ?? "").trim() || en,
    ipa: String(w.ipa ?? "").trim() || `/${en}/`,
  };
}

function validateSentenceToken(
  data: unknown,
  sentenceIndex: number,
  tokenIndex: number,
): CourseSentenceToken {
  if (!data || typeof data !== "object") {
    throw new Error(
      `练习 #${sentenceIndex + 1} 的 tokens[${tokenIndex}] 格式错误。`,
    );
  }
  const t = data as Record<string, unknown>;
  const en = String(t.en ?? "").trim();
  if (!en) {
    throw new Error(
      `练习 #${sentenceIndex + 1} 的 tokens[${tokenIndex}] 缺少英文。`,
    );
  }
  const posRaw = String(t.pos ?? "").trim();
  const pos = normalizeTokenPos(posRaw);
  if (!pos) {
    throw new Error(
      `练习 #${sentenceIndex + 1} 的 tokens[${tokenIndex}] 词性无效（收到「${posRaw || "空"}」）。允许：感叹词/代词/动词/系动词/助动词/名词/形容词/副词/冠词/限定词/介词/连词/数词/疑问词。`,
    );
  }
  const roleRaw = String(t.role ?? "").trim();
  // 无法识别时降级为 word，避免整课因个别 role 拼写失败
  const role = normalizeTokenRole(roleRaw) ?? "word";
  const zh = String(t.zh ?? "").trim() || en;
  return {
    en,
    zh,
    zhDetail: String(t.zhDetail ?? "").trim() || zh,
    ipa: String(t.ipa ?? "").trim() || `/${en}/`,
    pos,
    role,
  };
}

function validateSentence(data: unknown, index: number): CourseSentence {
  if (!data || typeof data !== "object") {
    throw new Error(`练习 #${index + 1} 格式错误。`);
  }
  const s = data as Record<string, unknown>;
  const rawEn = String(s.en ?? "").trim();
  if (!rawEn) throw new Error(`练习 #${index + 1} 缺少英文。`);
  const levelRaw = String(s.level ?? "sentence");
  const level = (LEVELS.has(levelRaw)
    ? levelRaw
    : "sentence") as CourseSentence["level"];

  const normalized = normalizeSentenceDialogue({
    en: rawEn,
    zh: String(s.zh ?? "").trim() || rawEn,
    speaker: String(s.speaker ?? "").trim() || undefined,
  });

  let tokens: CourseSentenceToken[] | undefined;
  if (s.tokens !== undefined && s.tokens !== null) {
    if (!Array.isArray(s.tokens) || s.tokens.length === 0) {
      throw new Error(`练习 #${index + 1} 的 tokens 须为非空数组。`);
    }
    tokens = s.tokens.map((token, i) => validateSentenceToken(token, index, i));
  }

  return {
    id: String(s.id ?? `ex-${index + 1}`).trim() || `ex-${index + 1}`,
    en: normalized.en,
    zh: normalized.zh || normalized.en,
    ipa: String(s.ipa ?? "").trim() || `/${normalized.en}/`,
    level,
    ...(normalized.speaker ? { speaker: normalized.speaker } : {}),
    ...(tokens ? { tokens } : {}),
  };
}

function clampDifficulty(value: unknown): CourseDifficulty {
  const n = Math.round(Number(value) || 2);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as CourseDifficulty;
}

/** 已是合法课程 id（含 user-*-uuid）时原样保留，避免 slugify 截断 UUID */
const SAFE_COURSE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_COURSE_ID_LEN = 128;

export function normalizeCourseId(input: string): string {
  const trimmed = input.toLowerCase().trim();
  if (
    SAFE_COURSE_ID.test(trimmed) &&
    trimmed.length >= 2 &&
    trimmed.length <= MAX_COURSE_ID_LEN
  ) {
    return trimmed;
  }
  return slugify(trimmed);
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const ascii = base.replace(/[^\x00-\x7F]/g, "");
  if (ascii.length >= 2) return ascii.slice(0, 48);
  return `course-${Date.now().toString(36)}`;
}

const UUID_SUFFIX =
  /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 生成用户课程 id：user-{slug}-{uuid}，全局唯一且可读 */
export function createUserCourseId(idOrTitle: string): string {
  const stripped = idOrTitle.replace(UUID_SUFFIX, "");
  const slug = slugify(stripped);
  const base = (slug.startsWith("user-") ? slug : `user-${slug}`).slice(0, 80);
  return `${base}-${crypto.randomUUID()}`;
}
