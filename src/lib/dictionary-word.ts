import { parseJsonWithRepair } from "@/lib/parse-ai-json";

export const DICTIONARY_QUESTION_TYPES = [
  "zh_to_en",
  "listening",
  "choice",
  "sentence_cloze",
  "en_to_zh_choice",
  "sentence_translation",
] as const;

export type DictionaryQuestionType = (typeof DICTIONARY_QUESTION_TYPES)[number];

const QUESTION_ID_SUFFIXES = [
  "zh",
  "listen",
  "choice",
  "cloze",
  "en2zh",
  "trans",
] as const;

export type DictionaryQuestion = {
  id: string;
  type: DictionaryQuestionType;
  prompt: string;
  answer: string;
  translation?: string;
  audioText?: string;
  targetForm?: string;
  options?: string[];
  hints?: string[];
};

export type DictionaryWordSource = {
  corpus: string;
  rank: number;
  paperId: string;
};

export type DictionaryWordEntry = {
  word: string;
  phonetic: string;
  phoneticUk?: string;
  meaning: string;
  partOfSpeech: string;
  example?: string;
  translation?: string;
  questions: DictionaryQuestion[];
  _source?: DictionaryWordSource;
};

const HAN = /[\u4e00-\u9fff]/;
const LATIN = /[A-Za-z]/;
const MAX_WORD_CHARS = 80;

/** Shared R2 slug: lowercase, trim, collapse spaces, unsafe chars → `-`. */
export function app2DictionarySlug(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function questionIdPrefix(word: string): string {
  return app2DictionarySlug(word);
}

export function expectedQuestionIds(word: string): string[] {
  const prefix = questionIdPrefix(word);
  return QUESTION_ID_SUFFIXES.map((suffix) => `${prefix}-${suffix}`);
}

/** 仅整理空白；词典形大小写由 AI 的 word 字段决定。 */
export function normalizeDictionaryWord(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

export function dictionarySourceFromInput(input: {
  corpus?: unknown;
  rank?: unknown;
}): DictionaryWordSource {
  const corpus =
    typeof input.corpus === "string" && input.corpus.trim()
      ? input.corpus.trim()
      : "custom";
  const rankNum = Number(input.rank);
  const rank = Number.isFinite(rankNum) ? Math.max(0, Math.round(rankNum)) : 0;
  return {
    corpus,
    rank,
    paperId: `${corpus}-${rank}-v1`,
  };
}

export const SYSTEM_GENERATE_DICTIONARY_WORD = `你是专业英语测评设计师。请根据用户给出的【单个】英语词或短语，生成可直接写入 dictionary/ 的词条 JSON。

只输出一个合法 JSON 对象。不要 Markdown，不要代码围栏，不要任何额外说明。

## 顶层结构（单词对象，不是套卷）
{
  "word": "词典形：字母与用户一致（color≠colour），但大小写按英语词典习惯",
  "phonetic": "/IPA/",
  "meaning": "中文释义；必须覆盖本题所有用到的义项，多义用中文分号「；」分隔",
  "partOfSpeech": "词性简写，如 n. / v. / adj. / adv. / prep. / phr.",
  "example": "含该词/短语的自然英文短句",
  "translation": "例句的中文翻译（纯中文）",
  "questions": [恰好 6 题，题型顺序固定],
  "_source": {
    "corpus": "用户给定的语料名；未给则用 custom",
    "rank": 用户给定的序号；未给则用 0,
    "paperId": "{corpus}-{rank}-v1"
  }
}

尽量生成以下 6 种题型，各 1 题，建议顺序：
zh_to_en → listening → choice → sentence_cloze → en_to_zh_choice → sentence_translation
某题拿不准可以少生成，不要硬凑错误题。禁止生成 drag 题型。禁止输出套卷外壳（不要 id/title/words 数组）。

## 题 id
用真实单词前缀，空格和非法字符改成连字符。6 题固定为：
{prefix}-zh、{prefix}-listen、{prefix}-choice、{prefix}-cloze、{prefix}-en2zh、{prefix}-trans
例：candy → candy-zh；in vain → in-vain-zh。禁止写成 word-zh。

## 题型细则
1. zh_to_en：打字题，不是选择题。prompt：「「中文释义」的英文是什么？」 answer：目标词/短语 hints：恰好 2 条中文提示。禁止 options。
2. listening：prompt 固定「听发音，选择正确的拼写」。audioText 和 answer 都是目标词/短语。options 恰好 8 个（1 答案 + 7 形近干扰）。只有本题用形近干扰。
3. choice：prompt 必须是「选择“中文词义”对应的英文」。options 恰好 8 个英文项，禁止汉字。
4. sentence_cloze：prompt 把目标换成一个 ___ 。整个短语一个 ___。answer 是原形。options 8 个英文。干扰项必须语义干扰禁止形近堆砌，禁止近义词，禁止超纲。translation 纯中文无 ___。
5. en_to_zh_choice：prompt 含目标词的英文整句。targetForm 是 prompt 子串。answer 是句中中文词义（不是整句）。options 8 个中文词义，语义干扰禁止近义堆砌。translation 是 prompt 整句的纯中文翻译，必须是完整句子，不能只写词义。
6. sentence_translation：prompt 英文整句。targetForm 子串。audioText 与 prompt 完全相同。answer 完整中文。options 8 个完整中文句子，必须是明显错译不是近义改写。

## 通用规则
- 字母拼写不得英美混改（color ≠ colour）；与用户比对时大小写不敏感，但 word 字段的大小写由你按词典习惯决定，服务端会原样采用。
- word 必须是词典形大小写：普通词小写（apple）；专有名词/商标规范大小写（London、iPhone）；常见缩写全大写（USA）。禁止把用户乱打的 APPLE/Apple/aPpLe 原样写进 word。
- 例句与题干中的目标词按英语习惯书写：句中普通词小写，仅句首或专有名词大写。zh_to_en/listening/choice/cloze 的 answer 必须与 word 字段大小写完全一致。targetForm 必须是 prompt 里实际出现的那一段（大小写与句中一致）。
- 中文纯中文。音标用斜杠。
- 带 options 的题尽量恰好 8 项，trim+小写去重后仍 8，answer 出现恰好 1 次；不合格题会被服务端丢弃。
- 义项必须写入 meaning。
- 禁止一例多用：example、cloze 完整句、en_to_zh prompt、translation prompt 必须 4 个不同英文句。`;

export class DictionaryValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues[0] || "词条格式无效");
    this.name = "DictionaryValidationError";
    this.issues = issues;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | undefined {
  const v = text(value);
  return v ? v : undefined;
}

function hasHan(s: string): boolean {
  return HAN.test(s);
}

function hasLatin(s: string): boolean {
  return LATIN.test(s);
}

function fold(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 在英文句中找到与 lemma 大小写不敏感匹配的实际片段（用于 targetForm）。 */
function matchLemmaSpan(sentence: string, lemma: string): string | null {
  const needle = fold(lemma);
  if (!needle || !sentence) return null;
  const hay = sentence;
  const hayFold = fold(hay);
  const at = hayFold.indexOf(needle);
  if (at < 0) return null;
  // fold 只做 lower+空白折叠；无空白变化时下标与原文一致
  if (hay.length === hayFold.length) {
    return hay.slice(at, at + needle.length);
  }
  // 空白被折叠时，用正则抓原文
  const pattern = needle
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = hay.match(new RegExp(pattern, "i"));
  return match?.[0] ?? null;
}

function clozeFilled(prompt: string, answer: string): string {
  return prompt.replace(/_{2,}/g, answer).replace(/\s+/g, " ").trim();
}

function optionsOk(
  question: DictionaryQuestion,
  kind: "en" | "zh",
  issues: string[],
): boolean {
  const options = question.options ?? [];
  if (options.length !== 8) {
    issues.push(`${question.type} 必须恰好 8 个选项（当前 ${options.length}）`);
    return false;
  }
  const trimmed = options.map((item) => item.trim()).filter(Boolean);
  if (trimmed.length !== 8) {
    issues.push(`${question.type} 选项不能为空`);
    return false;
  }
  const folded = trimmed.map((item) => item.toLowerCase());
  if (new Set(folded).size !== 8) {
    issues.push(`${question.type} 选项去重后不足 8 个`);
    return false;
  }
  const answerFold = fold(question.answer);
  const hits = folded.filter((item) => item === answerFold).length;
  if (hits !== 1) {
    issues.push(`${question.type} 的 answer 必须在 options 中恰好出现 1 次`);
    return false;
  }
  for (const item of trimmed) {
    if (kind === "en" && hasHan(item)) {
      issues.push(`${question.type} 选项必须是英文，不能含汉字`);
      return false;
    }
    if (kind === "zh" && !hasHan(item)) {
      issues.push(`${question.type} 选项必须是中文`);
      return false;
    }
  }
  return true;
}

const QUESTION_ID_BY_TYPE: Record<DictionaryQuestionType, string> = {
  zh_to_en: "zh",
  listening: "listen",
  choice: "choice",
  sentence_cloze: "cloze",
  en_to_zh_choice: "en2zh",
  sentence_translation: "trans",
};

/** 单题校验；失败只丢掉该题，不拖垮整词。 */
function questionPasses(
  question: DictionaryQuestion,
  canonicalWord: string,
  issues: string[],
): boolean {
  if (!(DICTIONARY_QUESTION_TYPES as readonly string[]).includes(question.type)) {
    issues.push(`丢弃无效题型：${question.type || "(空)"}`);
    return false;
  }
  if (!question.prompt || !question.answer) {
    issues.push(`${question.type} 缺少 prompt/answer，已丢弃`);
    return false;
  }

  if (question.type === "zh_to_en") {
    if (question.options && question.options.length > 0) {
      issues.push("zh_to_en 禁止 options，已丢弃");
      return false;
    }
    if (!question.hints || question.hints.length !== 2) {
      issues.push("zh_to_en 必须恰好 2 条 hints，已丢弃");
      return false;
    }
    if (canonicalWord && fold(question.answer) !== fold(canonicalWord)) {
      issues.push("zh_to_en 的 answer 必须是目标词/短语，已丢弃");
      return false;
    }
    return true;
  }

  if (question.type === "listening") {
    if (question.prompt !== "听发音，选择正确的拼写") {
      issues.push("listening 的 prompt 不正确，已丢弃");
      return false;
    }
    if (canonicalWord && fold(question.answer) !== fold(canonicalWord)) {
      issues.push("listening 的 answer 必须是目标词/短语，已丢弃");
      return false;
    }
    if (canonicalWord && fold(question.audioText || "") !== fold(canonicalWord)) {
      issues.push("listening 的 audioText 必须是目标词/短语，已丢弃");
      return false;
    }
    return optionsOk(question, "en", issues);
  }

  if (question.type === "choice") {
    if (!question.prompt.includes("对应的英文")) {
      issues.push("choice 的 prompt 不正确，已丢弃");
      return false;
    }
    if (canonicalWord && fold(question.answer) !== fold(canonicalWord)) {
      issues.push("choice 的 answer 必须是目标词/短语，已丢弃");
      return false;
    }
    return optionsOk(question, "en", issues);
  }

  if (question.type === "sentence_cloze") {
    if (!/_{3,}/.test(question.prompt)) {
      issues.push("sentence_cloze 的 prompt 必须含 ___，已丢弃");
      return false;
    }
    if ((question.prompt.match(/_{3,}/g) || []).length !== 1) {
      issues.push("sentence_cloze 只能有一个 ___，已丢弃");
      return false;
    }
    if (canonicalWord && fold(question.answer) !== fold(canonicalWord)) {
      issues.push("sentence_cloze 的 answer 必须是原形，已丢弃");
      return false;
    }
    if (!question.translation || !hasHan(question.translation)) {
      issues.push("sentence_cloze 需要纯中文 translation，已丢弃");
      return false;
    }
    if (/_{3,}/.test(question.translation)) {
      issues.push("sentence_cloze 的 translation 不能含 ___，已丢弃");
      return false;
    }
    return optionsOk(question, "en", issues);
  }

  if (question.type === "en_to_zh_choice") {
    if (!hasLatin(question.prompt)) {
      issues.push("en_to_zh_choice 的 prompt 必须是英文整句，已丢弃");
      return false;
    }
    const form = matchLemmaSpan(question.prompt, question.targetForm || canonicalWord);
    if (!form) {
      issues.push("en_to_zh_choice 的 targetForm 必须是 prompt 子串，已丢弃");
      return false;
    }
    question.targetForm = form;
    if (!hasHan(question.answer)) {
      issues.push("en_to_zh_choice 的 answer 必须是中文词义，已丢弃");
      return false;
    }
    return optionsOk(question, "zh", issues);
  }

  if (question.type === "sentence_translation") {
    if (!hasLatin(question.prompt)) {
      issues.push("sentence_translation 的 prompt 必须是英文整句，已丢弃");
      return false;
    }
    const form = matchLemmaSpan(question.prompt, question.targetForm || canonicalWord);
    if (!form) {
      issues.push("sentence_translation 的 targetForm 必须是 prompt 子串，已丢弃");
      return false;
    }
    question.targetForm = form;
    if ((question.audioText || "") !== question.prompt) {
      issues.push("sentence_translation 的 audioText 必须与 prompt 相同，已丢弃");
      return false;
    }
    if (!hasHan(question.answer)) {
      issues.push("sentence_translation 的 answer 必须是完整中文，已丢弃");
      return false;
    }
    return optionsOk(question, "zh", issues);
  }

  issues.push(`未支持的题型 ${question.type}，已丢弃`);
  return false;
}

function parseQuestion(
  raw: unknown,
  index: number,
  issues: string[],
): DictionaryQuestion | null {
  const obj = asRecord(raw);
  if (!obj) {
    issues.push(`第 ${index + 1} 题不是对象，已丢弃`);
    return null;
  }
  const type = text(obj.type);
  if (type === "drag") {
    issues.push(`第 ${index + 1} 题是 drag，已丢弃`);
    return null;
  }
  if (!(DICTIONARY_QUESTION_TYPES as readonly string[]).includes(type)) {
    issues.push(`第 ${index + 1} 题题型无效：${type || "(空)"}，已丢弃`);
    return null;
  }
  const question: DictionaryQuestion = {
    id: text(obj.id) || `${questionIdPrefix("word")}-${index + 1}`,
    type: type as DictionaryQuestionType,
    prompt: text(obj.prompt),
    answer: text(obj.answer),
    translation: optionalText(obj.translation),
    audioText: optionalText(obj.audioText),
    targetForm: optionalText(obj.targetForm),
    options: Array.isArray(obj.options)
      ? obj.options.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0)
      : undefined,
    hints: Array.isArray(obj.hints)
      ? obj.hints.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0)
      : undefined,
  };
  return question;
}

export type ValidateDictionaryOptions = {
  /** When set, answers that should be the headword must match this spelling. */
  expectedWord?: string;
  /** Rewrite `word` / `_source` onto the returned entry. */
  source?: DictionaryWordSource;
};

export function validateDictionaryEntry(
  raw: unknown,
  opts: ValidateDictionaryOptions = {},
): DictionaryWordEntry {
  const issues: string[] = [];
  const obj = asRecord(raw);
  if (!obj) {
    throw new DictionaryValidationError(["AI 没有返回词条对象"]);
  }
  if (Array.isArray(obj.words) || obj.title != null && obj.words != null) {
    issues.push("禁止输出套卷外壳（不要 id/title/words 数组）");
  }

  const word = text(obj.word);
  if (!word) issues.push("缺少 word");
  if (word.length > MAX_WORD_CHARS) issues.push("word 过长");
  if (
    opts.expectedWord &&
    word &&
    fold(word) !== fold(opts.expectedWord)
  ) {
    issues.push("word 必须与用户给定拼写完全一致（不得改写 color/colour）");
  }

  const phonetic = text(obj.phonetic);
  if (!phonetic) issues.push("缺少 phonetic");
  else if (!phonetic.includes("/")) issues.push("phonetic 必须使用斜杠标注");

  const meaning = text(obj.meaning);
  if (!meaning) issues.push("缺少 meaning");
  else if (!hasHan(meaning)) issues.push("meaning 必须是中文");

  const partOfSpeech = text(obj.partOfSpeech);
  if (!partOfSpeech) issues.push("缺少 partOfSpeech");

  const example = optionalText(obj.example);
  if (!example) issues.push("缺少 example");
  else if (!hasLatin(example)) issues.push("example 必须是英文短句");

  const translation = optionalText(obj.translation);
  if (!translation) issues.push("缺少 translation");
  else if (!hasHan(translation)) issues.push("例句 translation 必须是中文");

  if (!Array.isArray(obj.questions)) {
    issues.push("缺少 questions 数组");
    throw new DictionaryValidationError(issues);
  }

  // 词头字段仍硬失败；题目改为逐题过滤
  if (issues.length > 0) {
    throw new DictionaryValidationError(issues);
  }

  const skipped: string[] = [];
  const canonicalWord = word;
  const prefix = questionIdPrefix(canonicalWord);
  const seenTypes = new Set<string>();
  const kept: DictionaryQuestion[] = [];

  for (let i = 0; i < obj.questions.length; i++) {
    const parsed = parseQuestion(obj.questions[i], i, skipped);
    if (!parsed) continue;
    if (seenTypes.has(parsed.type)) {
      skipped.push(`${parsed.type} 重复，已丢弃多余题`);
      continue;
    }
    const local: string[] = [];
    if (!questionPasses(parsed, canonicalWord, local)) {
      skipped.push(...local);
      continue;
    }
    seenTypes.add(parsed.type);
    const suffix = QUESTION_ID_BY_TYPE[parsed.type];
    let next: DictionaryQuestion = {
      ...parsed,
      id: suffix ? `${prefix}-${suffix}` : parsed.id || `${prefix}-${i + 1}`,
    };
    const isTargetAnswer =
      next.type === "zh_to_en" ||
      next.type === "listening" ||
      next.type === "choice" ||
      next.type === "sentence_cloze";
    if (isTargetAnswer && fold(next.answer) === fold(canonicalWord)) {
      next = { ...next, answer: canonicalWord };
    }
    if (next.type === "listening") {
      next = {
        ...next,
        audioText: canonicalWord,
        options: (next.options ?? []).map((item) =>
          fold(item) === fold(canonicalWord) ? canonicalWord : item,
        ),
      };
    }
    if (next.type === "choice" || next.type === "sentence_cloze") {
      next = {
        ...next,
        options: (next.options ?? []).map((item) =>
          fold(item) === fold(canonicalWord) ? canonicalWord : item,
        ),
      };
    }
    kept.push(next);
  }

  // 尽量按标准题型顺序输出；有多少合格题就留多少
  kept.sort(
    (a, b) =>
      DICTIONARY_QUESTION_TYPES.indexOf(a.type) -
      DICTIONARY_QUESTION_TYPES.indexOf(b.type),
  );

  if (kept.length === 0) {
    throw new DictionaryValidationError([
      "没有可用题目",
      ...skipped.slice(0, 12),
    ]);
  }

  const cloze = kept.find((q) => q.type === "sentence_cloze");
  const enToZh = kept.find((q) => q.type === "en_to_zh_choice");
  const trans = kept.find((q) => q.type === "sentence_translation");
  if (example && cloze && enToZh && trans) {
    const sentences = [
      fold(example),
      fold(clozeFilled(cloze.prompt, cloze.answer)),
      fold(enToZh.prompt),
      fold(trans.prompt),
    ];
    if (sentences.some((s) => !s) || new Set(sentences).size !== 4) {
      // 例句撞车时丢掉 translation 题，尽量保住其余
      const idx = kept.findIndex((q) => q.type === "sentence_translation");
      if (idx >= 0) {
        skipped.push("例句与题干英文句重复，已丢弃 sentence_translation");
        kept.splice(idx, 1);
      }
    }
  }

  if (kept.length === 0) {
    throw new DictionaryValidationError([
      "没有可用题目",
      ...skipped.slice(0, 12),
    ]);
  }

  const entry: DictionaryWordEntry = {
    word: canonicalWord,
    phonetic,
    meaning,
    partOfSpeech,
    example,
    translation,
    questions: kept,
  };
  const phoneticUk = optionalText(obj.phoneticUk);
  if (phoneticUk) entry.phoneticUk = phoneticUk;
  if (opts.source) entry._source = opts.source;
  else {
    const src = asRecord(obj._source);
    if (src) entry._source = dictionarySourceFromInput(src);
  }
  return entry;
}

export function parseDictionaryWordContent(
  raw: string,
  opts: ValidateDictionaryOptions = {},
): DictionaryWordEntry {
  let parsed: unknown;
  try {
    parsed = parseJsonWithRepair(raw);
  } catch {
    throw new DictionaryValidationError(["AI 返回的内容不是有效 JSON"]);
  }
  return validateDictionaryEntry(parsed, opts);
}

export function collectDictionarySpeakableTexts(
  entry: DictionaryWordEntry,
): string[] {
  const seen = new Set<string>();
  const texts: string[] = [];
  const add = (value?: string) => {
    const speak = value?.trim();
    if (!speak || !hasLatin(speak)) return;
    const key = fold(speak);
    if (!key || seen.has(key)) return;
    seen.add(key);
    texts.push(speak);
  };
  add(entry.word);
  add(entry.example);
  for (const question of entry.questions) {
    add(question.audioText);
    // App2 句中选义 / 听句选译：朗读 prompt 英文句（未必带 audioText）
    if (
      question.type === "en_to_zh_choice" ||
      question.type === "sentence_translation"
    ) {
      add(question.prompt);
    }
    // App2 句中填空：朗读填入答案后的完整句
    if (question.type === "sentence_cloze") {
      add(clozeFilled(question.prompt, question.answer));
    }
  }
  return texts;
}

export function dictionaryRepairUserMessage(
  word: string,
  issues: string[],
  previous: string,
): string {
  const clipped = previous.length > 8000 ? `${previous.slice(0, 8000)}\n…` : previous;
  return [
    word,
    "",
    "上次输出未通过校验，请只输出修正后的完整 JSON 对象。",
    "问题：",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "上次输出：",
    clipped,
  ].join("\n");
}
