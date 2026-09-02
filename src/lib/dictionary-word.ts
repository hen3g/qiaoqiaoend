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

export function normalizeDictionaryWord(raw: unknown): string {
  return String(raw ?? "").trim();
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
  "word": "必须与用户给定拼写、空格、大小写、标点完全一致",
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

每个单词必须恰好以下 6 种题型，各 1 题，顺序不可变：
zh_to_en → listening → choice → sentence_cloze → en_to_zh_choice → sentence_translation
禁止生成 drag 题型。禁止输出套卷外壳（不要 id/title/words 数组）。

## 题 id
用真实单词前缀，空格和非法字符改成连字符。6 题固定为：
{prefix}-zh、{prefix}-listen、{prefix}-choice、{prefix}-cloze、{prefix}-en2zh、{prefix}-trans
例：candy → candy-zh；in vain → in-vain-zh。禁止写成 word-zh。

## 题型细则
1. zh_to_en：打字题，不是选择题。prompt：「「中文释义」的英文是什么？」 answer：目标词/短语 hints：恰好 2 条中文提示。禁止 options。
2. listening：prompt 固定「听发音，选择正确的拼写」。audioText 和 answer 都是目标词/短语。options 恰好 8 个（1 答案 + 7 形近干扰）。只有本题用形近干扰。
3. choice：prompt 必须是「选择“中文词义”对应的英文」。options 恰好 8 个英文项，禁止汉字。
4. sentence_cloze：prompt 把目标换成一个 ___ 。整个短语一个 ___。answer 是原形。options 8 个英文。干扰项必须语义干扰禁止形近堆砌，禁止近义词，禁止超纲。translation 纯中文无 ___。
5. en_to_zh_choice：prompt 含目标词的英文整句。targetForm 是 prompt 子串。answer 是句中中文词义。options 8 个中文词义，语义干扰禁止近义堆砌。
6. sentence_translation：prompt 英文整句。targetForm 子串。audioText 与 prompt 完全相同。answer 完整中文。options 8 个完整中文句子，必须是明显错译不是近义改写。

## 通用规则
- 不得改写用户给定拼写（color ≠ colour）。
- 中文纯中文。音标用斜杠。
- 带 options 的题恰好 8 项，trim+小写去重后仍 8，answer 出现恰好 1 次。
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

function clozeFilled(prompt: string, answer: string): string {
  return prompt.replace(/_{3,}/g, answer).replace(/\s+/g, " ").trim();
}

function validateOptions(
  question: DictionaryQuestion,
  issues: string[],
  kind: "en" | "zh",
): void {
  const options = question.options ?? [];
  if (options.length !== 8) {
    issues.push(`${question.type} 必须恰好 8 个选项（当前 ${options.length}）`);
    return;
  }
  const trimmed = options.map((item) => item.trim()).filter(Boolean);
  if (trimmed.length !== 8) {
    issues.push(`${question.type} 选项不能为空`);
    return;
  }
  const folded = trimmed.map((item) => item.toLowerCase());
  if (new Set(folded).size !== 8) {
    issues.push(`${question.type} 选项去重后不足 8 个`);
  }
  const answerFold = fold(question.answer);
  const hits = folded.filter((item) => item === answerFold).length;
  if (hits !== 1) {
    issues.push(`${question.type} 的 answer 必须在 options 中恰好出现 1 次`);
  }
  for (const item of trimmed) {
    if (kind === "en" && hasHan(item)) {
      issues.push(`${question.type} 选项必须是英文，不能含汉字`);
      break;
    }
    if (kind === "zh" && !hasHan(item)) {
      issues.push(`${question.type} 选项必须是中文`);
      break;
    }
  }
}

function parseQuestion(
  raw: unknown,
  index: number,
  issues: string[],
): DictionaryQuestion | null {
  const obj = asRecord(raw);
  if (!obj) {
    issues.push(`第 ${index + 1} 题不是对象`);
    return null;
  }
  const type = text(obj.type);
  if (
    !(DICTIONARY_QUESTION_TYPES as readonly string[]).includes(type) &&
    type !== "drag"
  ) {
    issues.push(`第 ${index + 1} 题题型无效：${type || "(空)"}`);
  }
  if (type === "drag") {
    issues.push("禁止生成 drag 题型");
  }
  const question: DictionaryQuestion = {
    id: text(obj.id),
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
  if (!question.id) issues.push(`第 ${index + 1} 题缺少 id`);
  if (!question.prompt) issues.push(`第 ${index + 1} 题缺少 prompt`);
  if (!question.answer) issues.push(`第 ${index + 1} 题缺少 answer`);
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
  if (obj.questions.length !== 6) {
    issues.push(`必须恰好 6 题（当前 ${obj.questions.length}）`);
  }

  const questions = obj.questions
    .map((item, i) => parseQuestion(item, i, issues))
    .filter((item): item is DictionaryQuestion => Boolean(item));

  const canonicalWord = opts.expectedWord || word;
  const expectedIds = canonicalWord ? expectedQuestionIds(canonicalWord) : [];

  for (let i = 0; i < Math.min(questions.length, 6); i++) {
    const q = questions[i]!;
    const expectedType = DICTIONARY_QUESTION_TYPES[i];
    if (q.type !== expectedType) {
      issues.push(`第 ${i + 1} 题必须是 ${expectedType}（当前 ${q.type}）`);
    }
    if (expectedIds[i] && q.id !== expectedIds[i]) {
      issues.push(`第 ${i + 1} 题 id 必须是 ${expectedIds[i]}（当前 ${q.id}）`);
    }
  }

  const [zhToEn, listening, choice, cloze, enToZh, trans] = questions;

  if (zhToEn && zhToEn.type === "zh_to_en") {
    if (zhToEn.options && zhToEn.options.length > 0) {
      issues.push("zh_to_en 禁止 options");
    }
    if (!zhToEn.hints || zhToEn.hints.length !== 2) {
      issues.push("zh_to_en 必须恰好 2 条 hints");
    }
    if (canonicalWord && fold(zhToEn.answer) !== fold(canonicalWord)) {
      issues.push("zh_to_en 的 answer 必须是目标词/短语");
    }
  }

  if (listening && listening.type === "listening") {
    if (listening.prompt !== "听发音，选择正确的拼写") {
      issues.push('listening 的 prompt 必须是「听发音，选择正确的拼写」');
    }
    if (canonicalWord && fold(listening.answer) !== fold(canonicalWord)) {
      issues.push("listening 的 answer 必须是目标词/短语");
    }
    if (canonicalWord && fold(listening.audioText || "") !== fold(canonicalWord)) {
      issues.push("listening 的 audioText 必须是目标词/短语");
    }
    validateOptions(listening, issues, "en");
  }

  if (choice && choice.type === "choice") {
    if (!choice.prompt.includes("对应的英文")) {
      issues.push('choice 的 prompt 必须是「选择“中文词义”对应的英文」');
    }
    if (canonicalWord && fold(choice.answer) !== fold(canonicalWord)) {
      issues.push("choice 的 answer 必须是目标词/短语");
    }
    validateOptions(choice, issues, "en");
  }

  if (cloze && cloze.type === "sentence_cloze") {
    if (!/_{3,}/.test(cloze.prompt)) {
      issues.push("sentence_cloze 的 prompt 必须把目标换成 ___");
    }
    if ((cloze.prompt.match(/_{3,}/g) || []).length !== 1) {
      issues.push("sentence_cloze 整个短语只能用一个 ___");
    }
    if (canonicalWord && fold(cloze.answer) !== fold(canonicalWord)) {
      issues.push("sentence_cloze 的 answer 必须是原形");
    }
    if (!cloze.translation || !hasHan(cloze.translation)) {
      issues.push("sentence_cloze 需要纯中文 translation");
    } else if (/_{3,}/.test(cloze.translation)) {
      issues.push("sentence_cloze 的 translation 不能含 ___");
    }
    validateOptions(cloze, issues, "en");
  }

  if (enToZh && enToZh.type === "en_to_zh_choice") {
    if (!hasLatin(enToZh.prompt)) {
      issues.push("en_to_zh_choice 的 prompt 必须是英文整句");
    }
    if (!enToZh.targetForm || !enToZh.prompt.includes(enToZh.targetForm)) {
      issues.push("en_to_zh_choice 的 targetForm 必须是 prompt 子串");
    }
    if (!hasHan(enToZh.answer)) {
      issues.push("en_to_zh_choice 的 answer 必须是中文词义");
    }
    validateOptions(enToZh, issues, "zh");
  }

  if (trans && trans.type === "sentence_translation") {
    if (!hasLatin(trans.prompt)) {
      issues.push("sentence_translation 的 prompt 必须是英文整句");
    }
    if (!trans.targetForm || !trans.prompt.includes(trans.targetForm)) {
      issues.push("sentence_translation 的 targetForm 必须是 prompt 子串");
    }
    if ((trans.audioText || "") !== trans.prompt) {
      issues.push("sentence_translation 的 audioText 必须与 prompt 完全相同");
    }
    if (!hasHan(trans.answer)) {
      issues.push("sentence_translation 的 answer 必须是完整中文");
    }
    validateOptions(trans, issues, "zh");
  }

  if (example && cloze && enToZh && trans) {
    const sentences = [
      fold(example),
      fold(clozeFilled(cloze.prompt, cloze.answer)),
      fold(enToZh.prompt),
      fold(trans.prompt),
    ];
    if (sentences.some((s) => !s) || new Set(sentences).size !== 4) {
      issues.push(
        "example、cloze 完整句、en_to_zh prompt、translation prompt 必须是 4 个不同英文句",
      );
    }
  }

  if (issues.length > 0) {
    throw new DictionaryValidationError(issues);
  }

  const entryWord = opts.expectedWord || word;
  const entry: DictionaryWordEntry = {
    word: entryWord,
    phonetic,
    meaning,
    partOfSpeech,
    example,
    translation,
    questions: questions.map((q, i) => {
      const next: DictionaryQuestion = {
        ...q,
        id: expectedIds[i] || q.id,
      };
      const isTargetAnswer =
        next.type === "zh_to_en" ||
        next.type === "listening" ||
        next.type === "choice" ||
        next.type === "sentence_cloze";
      if (isTargetAnswer && fold(next.answer) === fold(entryWord)) {
        next.answer = entryWord;
      }
      if (next.type === "listening") {
        next.audioText = entryWord;
        next.options = (next.options ?? []).map((item) =>
          fold(item) === fold(entryWord) ? entryWord : item,
        );
      }
      if (next.type === "choice" || next.type === "sentence_cloze") {
        next.options = (next.options ?? []).map((item) =>
          fold(item) === fold(entryWord) ? entryWord : item,
        );
      }
      return next;
    }),
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
