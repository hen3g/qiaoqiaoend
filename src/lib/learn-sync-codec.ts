/**
 * 仓鼠单词 cloud sync — shared snapshot model, compact codec and merge rules.
 *
 * Pure TypeScript with no imports. Keep byte-identical copies in:
 *   app2/src/lib/cloud-sync-codec.ts
 *   qiaoqiaoend/src/lib/learn-sync-codec.ts
 *
 * Wire format (JSON, then gzip):
 *   doc     = [ver, courses[], plan|0, review|0, active|0, wordBook, blacklist]
 *   course  = [id, mMin, bestStreak, placement|0, seed|0, resetAtMin, words[], del[]]
 *   word    = [word, lastSeenDelta, mRel, flags, score, correct, seen, sessions,
 *              totalQuestions, introRel, days[], questions[], paperId]
 *             (trailing defaults dropped; words sorted by lastSeen, delta-coded)
 *   question= [key, seen, correct, lastRel, nextRel, pending]
 *   set     = [adds[[word, minDelta]], dels[[word, minDelta]]]
 * Times are minutes since 2024-01-01 UTC (+1 so 0 means "none").
 * Practice days are day numbers since 2024-01-01, delta-coded.
 */

export const SYNC_SCHEMA_VERSION = 1;
export const SYNC_EPOCH_MS = Date.UTC(2024, 0, 1);
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export const SYNC_LIMITS = {
  maxGzBytes: 1024 * 1024,
  maxRawBytes: 8 * 1024 * 1024,
  maxCourses: 64,
  maxWordsPerCourse: 40_000,
  maxQuestionsPerWord: 64,
  maxPracticeDays: 1_000,
  maxSetItems: 20_000,
  maxTombstonesPerCourse: 40_000,
  maxStringLength: 160,
  maxPlanBytes: 4_096,
  maxCount: 1_000_000_000,
} as const;

/** Tombstones older than this are pruned (deleted words / set items). */
export const TOMBSTONE_TTL_MS = 400 * DAY_MS;

export type SyncQuestion = {
  /** seen */
  s: number;
  /** correct */
  c: number;
  /** lastSeenAt (ms) */
  l: number;
  /** nextReviewAt (ms) */
  n: number;
  /** pendingRetry */
  p: boolean;
};

export type SyncWord = {
  /** Last local modification (ms); drives last-writer-wins fields. */
  m: number;
  /** paperId when it differs from the word itself. */
  pid: string | null;
  score: number;
  correct: number;
  seen: number;
  sessions: number;
  lastSeenAt: number;
  introducedAt: number;
  totalQuestions: number;
  introduced: boolean;
  skipped: boolean;
  /** practiceDays, YYYY-MM-DD, sorted. */
  days: string[];
  q: Record<string, SyncQuestion>;
};

export type SyncPlacement = {
  estimatedSize: number;
  startRank: number;
  completedAt: number;
};

export type SyncCourse = {
  /** Meta (placement / seed) modification time; 0 = meta not included. */
  m: number;
  bestStreak: number;
  placement: SyncPlacement | null;
  seed: number | null;
  /** Course reset time: words last touched at or before it are dropped. */
  resetAt: number;
  words: Record<string, SyncWord>;
  /** Word tombstones: word → deletedAt (ms). */
  del: Record<string, number>;
};

export type SyncLww<T> = { m: number; v: T };

export type SyncSet = {
  add: Record<string, number>;
  del: Record<string, number>;
};

export type SyncDoc = {
  courses: Record<string, SyncCourse>;
  plan: SyncLww<Record<string, unknown>> | null;
  review: SyncLww<boolean> | null;
  active: SyncLww<string | null> | null;
  wordBook: SyncSet;
  blacklist: SyncSet;
};

export class SyncCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncCodecError";
  }
}

// ---------------------------------------------------------------------------
// Small helpers (null-prototype maps so words like "constructor" are safe)

export function dict<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

const hasOwn = Object.prototype.hasOwnProperty;

export function own<T>(map: Record<string, T>, key: string): T | undefined {
  return hasOwn.call(map, key) ? map[key] : undefined;
}

function keysOf(map: Record<string, unknown>): string[] {
  return Object.keys(map);
}

function fail(message: string): never {
  throw new SyncCodecError(message);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function readInt(value: unknown, min: number, max: number, what: string): number {
  if (!isInt(value) || value < min || value > max) fail(`bad ${what}`);
  return value;
}

function readCount(value: unknown, what: string): number {
  return readInt(value, 0, SYNC_LIMITS.maxCount, what);
}

function readString(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`bad ${what}`);
  if (value.length > SYNC_LIMITS.maxStringLength) fail(`${what} too long`);
  return value;
}

function readArray(value: unknown, max: number, what: string): unknown[] {
  if (!Array.isArray(value)) fail(`bad ${what}`);
  if (value.length > max) fail(`too many ${what}`);
  return value;
}

/** ms → minutes since epoch (+1). 0 / negative / NaN → 0 ("none"). */
export function toMin(ms: number): number {
  if (!(ms > 0)) return 0;
  return Math.max(1, Math.floor((ms - SYNC_EPOCH_MS) / MINUTE_MS) + 1);
}

export function fromMin(min: number): number {
  if (!(min > 0)) return 0;
  return SYNC_EPOCH_MS + (min - 1) * MINUTE_MS;
}

/** Same precision the wire keeps (whole minutes). */
export function roundSyncTime(ms: number): number {
  return fromMin(toMin(ms));
}

const MAX_MIN = 60 * 24 * 366 * 200; // ~200 years of minutes
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayToNum(day: string): number | null {
  const match = DAY_RE.exec(day);
  if (!match) return null;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(at)) return null;
  return Math.round((at - SYNC_EPOCH_MS) / DAY_MS);
}

function numToDay(num: number): string {
  const date = new Date(SYNC_EPOCH_MS + num * DAY_MS);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Question id compression: "apple-choice" → small int when it follows the
// dictionary's `${slug}-${suffix}` shape; anything else is kept verbatim.

const Q_SUFFIXES = [
  "zh",
  "listen",
  "choice",
  "cloze",
  "en2zh",
  "trans",
  "listen-spell",
  "zh-speak",
  "drag",
];

function questionPrefixes(word: string): string[] {
  const lower = word.toLowerCase();
  return [
    `${lower.replace(/\s+/g, "-")}-`,
    `${word}-`,
    `${lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-`,
  ];
}

export function encodeQuestionId(word: string, id: string): number | string {
  const prefixes = questionPrefixes(word);
  for (let index = 0; index < prefixes.length; index += 1) {
    const prefix = prefixes[index]!;
    if (prefix.length <= 1 || !id.startsWith(prefix)) continue;
    const suffix = Q_SUFFIXES.indexOf(id.slice(prefix.length));
    if (suffix >= 0) return index * 16 + suffix;
  }
  for (let index = 0; index < prefixes.length; index += 1) {
    const prefix = prefixes[index]!;
    if (prefix.length <= 1 || !id.startsWith(prefix)) continue;
    const rest = id.slice(prefix.length);
    if (rest) return `${index}|${rest}`;
  }
  return `=${id}`;
}

export function decodeQuestionId(word: string, key: unknown): string {
  const prefixes = questionPrefixes(word);
  if (isInt(key)) {
    const prefix = prefixes[Math.floor(key / 16)];
    const suffix = Q_SUFFIXES[key % 16];
    if (key < 0 || !prefix || !suffix) fail("bad question key");
    return prefix + suffix;
  }
  if (typeof key !== "string" || key.length < 2) fail("bad question key");
  if (key.length > SYNC_LIMITS.maxStringLength + 2) fail("question key too long");
  if (key[0] === "=") return key.slice(1);
  const match = /^(\d)\|(.+)$/.exec(key);
  const prefix = match ? prefixes[Number(match[1])] : undefined;
  if (!match || !prefix) fail("bad question key");
  return prefix + match[2];
}

// ---------------------------------------------------------------------------
// Constructors / clones

export function emptySyncSet(): SyncSet {
  return { add: dict<number>(), del: dict<number>() };
}

export function emptySyncCourse(): SyncCourse {
  return {
    m: 0,
    bestStreak: 0,
    placement: null,
    seed: null,
    resetAt: 0,
    words: dict<SyncWord>(),
    del: dict<number>(),
  };
}

export function emptySyncDoc(): SyncDoc {
  return {
    courses: dict<SyncCourse>(),
    plan: null,
    review: null,
    active: null,
    wordBook: emptySyncSet(),
    blacklist: emptySyncSet(),
  };
}

function cloneQuestion(q: SyncQuestion): SyncQuestion {
  return { s: q.s, c: q.c, l: q.l, n: q.n, p: q.p };
}

export function cloneSyncWord(word: SyncWord): SyncWord {
  const q = dict<SyncQuestion>();
  for (const id of keysOf(word.q)) q[id] = cloneQuestion(word.q[id]!);
  return { ...word, days: [...word.days], q };
}

function cloneMap<T>(map: Record<string, T>, copy: (v: T) => T): Record<string, T> {
  const next = dict<T>();
  for (const key of keysOf(map)) next[key] = copy(map[key]!);
  return next;
}

export function cloneSyncCourse(course: SyncCourse): SyncCourse {
  return {
    m: course.m,
    bestStreak: course.bestStreak,
    placement: course.placement ? { ...course.placement } : null,
    seed: course.seed,
    resetAt: course.resetAt,
    words: cloneMap(course.words, cloneSyncWord),
    del: cloneMap(course.del, (v) => v),
  };
}

function cloneSet(set: SyncSet): SyncSet {
  return {
    add: cloneMap(set.add, (v) => v),
    del: cloneMap(set.del, (v) => v),
  };
}

export function cloneSyncDoc(doc: SyncDoc): SyncDoc {
  return {
    courses: cloneMap(doc.courses, cloneSyncCourse),
    plan: doc.plan
      ? { m: doc.plan.m, v: JSON.parse(JSON.stringify(doc.plan.v)) as Record<string, unknown> }
      : null,
    review: doc.review ? { ...doc.review } : null,
    active: doc.active ? { ...doc.active } : null,
    wordBook: cloneSet(doc.wordBook),
    blacklist: cloneSet(doc.blacklist),
  };
}

// ---------------------------------------------------------------------------
// Encode

function relTime(min: number, base: number): number | null {
  return min === 0 ? null : base - min;
}

function trimTrailing(row: unknown[], defaults: unknown[]): unknown[] {
  let end = row.length;
  while (end > 1) {
    const value = row[end - 1];
    const fallback = defaults[end - 1];
    const same =
      value === fallback ||
      (Array.isArray(value) &&
        Array.isArray(fallback) &&
        value.length === 0 &&
        fallback.length === 0);
    if (!same) break;
    end -= 1;
  }
  return row.slice(0, end);
}

const WORD_DEFAULTS: unknown[] = [
  undefined, // word
  undefined, // lastSeenDelta
  null, // mRel
  1, // flags (introduced)
  0, // score
  0, // correct
  0, // seen
  0, // sessions
  0, // totalQuestions
  null, // introRel
  [], // days
  [], // questions
  null, // paperId
];

const QUESTION_DEFAULTS: unknown[] = [undefined, 0, 0, null, null, 0];

function encodeQuestions(word: string, q: Record<string, SyncQuestion>, base: number) {
  const ids = keysOf(q).sort();
  return ids.map((id) => {
    const item = q[id]!;
    const l = toMin(item.l);
    const n = toMin(item.n);
    return trimTrailing(
      [
        encodeQuestionId(word, id),
        item.s,
        item.c,
        relTime(l, base),
        n === 0 ? null : n - (l || base),
        item.p ? 1 : 0,
      ],
      QUESTION_DEFAULTS,
    );
  });
}

function encodeDays(days: string[]): number[] {
  const nums: number[] = [];
  for (const day of days) {
    const num = dayToNum(day);
    if (num != null) nums.push(num);
  }
  nums.sort((a, b) => a - b);
  const out: number[] = [];
  let prev = 0;
  for (const num of nums) {
    if (out.length > 0 && num === prev) continue;
    out.push(num - prev);
    prev = num;
  }
  return out;
}

function encodeTimedPairs(map: Record<string, number>): unknown[] {
  const rows = keysOf(map)
    .map((key) => [key, toMin(map[key]!)] as const)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let prev = 0;
  return rows.map(([key, min]) => {
    const delta = min - prev;
    prev = min;
    return [key, delta];
  });
}

function encodeCourse(id: string, course: SyncCourse): unknown[] {
  const rows = keysOf(course.words)
    .map((word) => ({ word, record: course.words[word]!, ls: toMin(course.words[word]!.lastSeenAt) }))
    .sort((a, b) => a.ls - b.ls || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  let prev = 0;
  const words = rows.map(({ word, record, ls }) => {
    const delta = ls - prev;
    prev = ls;
    const flags = (record.introduced ? 1 : 0) | (record.skipped ? 2 : 0);
    return trimTrailing(
      [
        word,
        delta,
        relTime(toMin(record.m), ls),
        flags,
        record.score,
        record.correct,
        record.seen,
        record.sessions,
        record.totalQuestions,
        relTime(toMin(record.introducedAt), ls),
        encodeDays(record.days),
        encodeQuestions(word, record.q, ls),
        record.pid && record.pid !== word ? record.pid : null,
      ],
      WORD_DEFAULTS,
    );
  });
  const placement = course.placement
    ? [
        course.placement.estimatedSize,
        course.placement.startRank,
        toMin(course.placement.completedAt),
      ]
    : 0;
  return [
    id,
    toMin(course.m),
    course.bestStreak,
    placement,
    course.seed ?? 0,
    toMin(course.resetAt),
    words,
    encodeTimedPairs(course.del),
  ];
}

export function encodeSyncDoc(doc: SyncDoc): unknown[] {
  const courses = keysOf(doc.courses)
    .sort()
    .map((id) => encodeCourse(id, doc.courses[id]!));
  return [
    SYNC_SCHEMA_VERSION,
    courses,
    doc.plan ? [toMin(doc.plan.m), doc.plan.v] : 0,
    doc.review ? [toMin(doc.review.m), doc.review.v ? 1 : 0] : 0,
    doc.active ? [toMin(doc.active.m), doc.active.v] : 0,
    [encodeTimedPairs(doc.wordBook.add), encodeTimedPairs(doc.wordBook.del)],
    [encodeTimedPairs(doc.blacklist.add), encodeTimedPairs(doc.blacklist.del)],
  ];
}

export function encodeSyncDocJson(doc: SyncDoc): string {
  return JSON.stringify(encodeSyncDoc(doc));
}

// ---------------------------------------------------------------------------
// Decode (strict: throws SyncCodecError on anything unexpected)

function absTime(rel: unknown, base: number, what: string): number {
  if (rel === null || rel === undefined) return 0;
  const value = readInt(rel, -MAX_MIN, MAX_MIN, what);
  const min = base - value;
  if (min < 1 || min > MAX_MIN) fail(`bad ${what}`);
  return fromMin(min);
}

function decodeDays(raw: unknown): string[] {
  const list = readArray(raw ?? [], SYNC_LIMITS.maxPracticeDays, "days");
  const out: string[] = [];
  let prev = 0;
  list.forEach((item, index) => {
    const delta = readInt(item, index === 0 ? -100_000 : 1, 100_000, "day");
    prev += delta;
    out.push(numToDay(prev));
  });
  return out;
}

function decodeQuestions(word: string, raw: unknown, base: number) {
  const list = readArray(raw ?? [], SYNC_LIMITS.maxQuestionsPerWord, "questions");
  const q = dict<SyncQuestion>();
  for (const row of list) {
    const item = readArray(row, 6, "question");
    if (item.length < 1) fail("bad question");
    const id = decodeQuestionId(word, item[0]);
    const l = absTime(item[3], base, "question time");
    const lMin = toMin(l);
    let n = 0;
    if (item[4] !== null && item[4] !== undefined) {
      const nMin = (lMin || base) + readInt(item[4], -MAX_MIN, MAX_MIN, "review time");
      if (nMin < 1 || nMin > MAX_MIN) fail("bad review time");
      n = fromMin(nMin);
    }
    q[id] = {
      s: readCount(item[1] ?? 0, "question seen"),
      c: readCount(item[2] ?? 0, "question correct"),
      l,
      n,
      p: readInt(item[5] ?? 0, 0, 1, "pending") === 1,
    };
  }
  return q;
}

function decodeTimedPairs(raw: unknown, max: number, what: string, minOne: boolean) {
  const list = readArray(raw ?? [], max, what);
  const map = dict<number>();
  let prev = 0;
  for (const row of list) {
    const pair = readArray(row, 2, what);
    const key = readString(pair[0], what);
    prev += readInt(pair[1], -MAX_MIN, MAX_MIN, `${what} time`);
    if (prev < (minOne ? 1 : 0) || prev > MAX_MIN) fail(`bad ${what} time`);
    map[key] = fromMin(prev);
  }
  return map;
}

function decodeCourse(raw: unknown): [string, SyncCourse] {
  const row = readArray(raw, 8, "course");
  if (row.length !== 8) fail("bad course");
  const id = readString(row[0], "course id");
  const course = emptySyncCourse();
  course.m = fromMin(readInt(row[1], 0, MAX_MIN, "course m"));
  course.bestStreak = readCount(row[2], "bestStreak");
  if (row[3] !== 0) {
    const p = readArray(row[3], 3, "placement");
    course.placement = {
      estimatedSize: readCount(p[0], "placement size"),
      startRank: readInt(p[1], 1, SYNC_LIMITS.maxCount, "placement rank"),
      completedAt: fromMin(readInt(p[2], 1, MAX_MIN, "placement time")),
    };
  }
  const seed = readInt(row[4], 0, 0xffffffff, "seed");
  course.seed = seed > 0 ? seed : null;
  course.resetAt = fromMin(readInt(row[5], 0, MAX_MIN, "resetAt"));
  const words = readArray(row[6], SYNC_LIMITS.maxWordsPerCourse, "words");
  let prev = 0;
  for (const wordRaw of words) {
    const w = readArray(wordRaw, 13, "word");
    if (w.length < 2) fail("bad word");
    const word = readString(w[0], "word");
    prev += readInt(w[1], -MAX_MIN, MAX_MIN, "word time");
    if (prev < 0 || prev > MAX_MIN) fail("bad word time");
    const flags = readInt(w[3] ?? 1, 0, 3, "word flags");
    const pid = w[12] === null || w[12] === undefined ? null : readString(w[12], "paperId");
    course.words[word] = {
      m: absTime(w[2], prev, "word m"),
      pid: pid && pid !== word ? pid : null,
      introduced: (flags & 1) === 1,
      skipped: (flags & 2) === 2,
      score: readCount(w[4] ?? 0, "score"),
      correct: readCount(w[5] ?? 0, "correct"),
      seen: readCount(w[6] ?? 0, "seen"),
      sessions: readCount(w[7] ?? 0, "sessions"),
      totalQuestions: readCount(w[8] ?? 0, "totalQuestions"),
      introducedAt: absTime(w[9], prev, "introducedAt"),
      lastSeenAt: fromMin(prev),
      days: decodeDays(w[10]),
      q: decodeQuestions(word, w[11], prev),
    };
  }
  course.del = decodeTimedPairs(row[7], SYNC_LIMITS.maxTombstonesPerCourse, "tombstone", true);
  return [id, course];
}

function validatePlanValue(value: unknown, depth = 0): void {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("bad plan");
    return;
  }
  if (typeof value === "string") {
    if (value.length > SYNC_LIMITS.maxStringLength) fail("bad plan");
    return;
  }
  if (depth > 2) fail("bad plan");
  if (Array.isArray(value)) {
    if (value.length > 64) fail("bad plan");
    for (const item of value) validatePlanValue(item, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length > 32) fail("bad plan");
    for (const key of keys) {
      if (key.length > 64) fail("bad plan");
      validatePlanValue((value as Record<string, unknown>)[key], depth + 1);
    }
    return;
  }
  fail("bad plan");
}

function decodeLwwHead(raw: unknown, what: string): [number, unknown] | null {
  if (raw === 0 || raw === null || raw === undefined) return null;
  const row = readArray(raw, 2, what);
  if (row.length !== 2) fail(`bad ${what}`);
  return [fromMin(readInt(row[0], 0, MAX_MIN, `${what} time`)), row[1]];
}

function decodeSet(raw: unknown, what: string): SyncSet {
  if (raw === 0 || raw === null || raw === undefined) return emptySyncSet();
  const row = readArray(raw, 2, what);
  return {
    add: decodeTimedPairs(row[0], SYNC_LIMITS.maxSetItems, what, true),
    del: decodeTimedPairs(row[1], SYNC_LIMITS.maxSetItems, what, true),
  };
}

export function decodeSyncDoc(raw: unknown): SyncDoc {
  const row = readArray(raw, 7, "doc");
  if (row[0] !== SYNC_SCHEMA_VERSION) fail("unsupported schema version");
  const doc = emptySyncDoc();
  const courses = readArray(row[1] ?? [], SYNC_LIMITS.maxCourses, "courses");
  for (const courseRaw of courses) {
    const [id, course] = decodeCourse(courseRaw);
    doc.courses[id] = course;
  }
  const plan = decodeLwwHead(row[2], "plan");
  if (plan) {
    const value = plan[1];
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("bad plan");
    validatePlanValue(value);
    if (JSON.stringify(value).length > SYNC_LIMITS.maxPlanBytes) fail("plan too large");
    doc.plan = { m: plan[0], v: value as Record<string, unknown> };
  }
  const review = decodeLwwHead(row[3], "review");
  if (review) doc.review = { m: review[0], v: readInt(review[1], 0, 1, "review") === 1 };
  const active = decodeLwwHead(row[4], "active");
  if (active) {
    doc.active = {
      m: active[0],
      v: active[1] === null ? null : readString(active[1], "active course"),
    };
  }
  doc.wordBook = decodeSet(row[5], "wordBook");
  doc.blacklist = decodeSet(row[6], "blacklist");
  return doc;
}

export function decodeSyncDocJson(json: string): SyncDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    fail("bad json");
  }
  return decodeSyncDoc(raw);
}

// ---------------------------------------------------------------------------
// Sanitize: make any in-memory doc encodable within the decoder's limits.
// Drops / clamps the odd bad value (over-long word, NaN count, huge list)
// instead of letting one item get the whole upload rejected forever.

const MAX_TIME_MS = SYNC_EPOCH_MS + (MAX_MIN - 1) * MINUTE_MS;

function cleanTime(ms: unknown): number {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!(n > 0) || !Number.isFinite(n)) return 0;
  return Math.min(n, MAX_TIME_MS);
}

function cleanCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, SYNC_LIMITS.maxCount);
}

function okKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= SYNC_LIMITS.maxStringLength;
}

function cleanDays(days: unknown): string[] {
  if (!Array.isArray(days)) return [];
  const out = new Set<string>();
  for (const day of days) {
    if (typeof day !== "string") continue;
    const num = dayToNum(day);
    // Decoder accepts ±100 000 days around 2024 and needs a real calendar day.
    if (num == null || Math.abs(num) > 99_999 || numToDay(num) !== day) continue;
    out.add(day);
  }
  const sorted = [...out].sort();
  return sorted.length > SYNC_LIMITS.maxPracticeDays
    ? sorted.slice(sorted.length - SYNC_LIMITS.maxPracticeDays)
    : sorted;
}

function newestKeys<T>(map: Record<string, T>, max: number, at: (value: T) => number): string[] {
  const keys = keysOf(map).filter(okKey);
  if (keys.length <= max) return keys;
  return keys.sort((a, b) => at(map[b]!) - at(map[a]!)).slice(0, max);
}

function cleanTimedMap(map: Record<string, number>, max: number): Record<string, number> {
  const out = dict<number>();
  const valid = dict<number>();
  for (const key of keysOf(map)) {
    const at = cleanTime(map[key]);
    if (okKey(key) && at > 0) valid[key] = at;
  }
  for (const key of newestKeys(valid, max, (v) => v)) out[key] = valid[key]!;
  return out;
}

function cleanWord(word: string, raw: SyncWord): SyncWord {
  const q = dict<SyncQuestion>();
  const ids = newestKeys(raw.q ?? {}, SYNC_LIMITS.maxQuestionsPerWord, (item) => cleanTime(item?.l));
  for (const id of ids) {
    const item = raw.q[id];
    if (!item) continue;
    q[id] = {
      s: cleanCount(item.s),
      c: cleanCount(item.c),
      l: cleanTime(item.l),
      n: cleanTime(item.n),
      p: item.p === true,
    };
  }
  return {
    m: cleanTime(raw.m),
    pid: okKey(raw.pid) && raw.pid !== word ? raw.pid : null,
    score: cleanCount(raw.score),
    correct: cleanCount(raw.correct),
    seen: cleanCount(raw.seen),
    sessions: cleanCount(raw.sessions),
    lastSeenAt: cleanTime(raw.lastSeenAt),
    introducedAt: cleanTime(raw.introducedAt),
    totalQuestions: cleanCount(raw.totalQuestions),
    introduced: raw.introduced !== false,
    skipped: raw.skipped === true,
    days: cleanDays(raw.days),
    q,
  };
}

function cleanCourse(raw: SyncCourse): SyncCourse {
  const course = emptySyncCourse();
  course.m = cleanTime(raw.m);
  course.bestStreak = cleanCount(raw.bestStreak);
  const placement = raw.placement;
  const completedAt = cleanTime(placement?.completedAt);
  course.placement =
    placement && completedAt > 0
      ? {
          estimatedSize: cleanCount(placement.estimatedSize),
          startRank: Math.max(1, cleanCount(placement.startRank)),
          completedAt,
        }
      : null;
  const seed = Number(raw.seed);
  course.seed = Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff ? seed : null;
  course.resetAt = cleanTime(raw.resetAt);
  const words = raw.words ?? dict<SyncWord>();
  for (const word of newestKeys(words, SYNC_LIMITS.maxWordsPerCourse, (w) => syncWordActivityAt(cleanWord("", w)))) {
    course.words[word] = cleanWord(word, words[word]!);
  }
  course.del = cleanTimedMap(raw.del ?? dict<number>(), SYNC_LIMITS.maxTombstonesPerCourse);
  return course;
}

function cleanLwwTime<T>(lww: SyncLww<T> | null): number {
  return lww ? cleanTime(lww.m) : 0;
}

export function sanitizeSyncDoc(doc: SyncDoc): SyncDoc {
  const out = emptySyncDoc();
  const ids = keysOf(doc.courses ?? {}).filter(okKey).sort().slice(0, SYNC_LIMITS.maxCourses);
  for (const id of ids) out.courses[id] = cleanCourse(doc.courses[id]!);
  if (doc.plan && doc.plan.v && typeof doc.plan.v === "object" && !Array.isArray(doc.plan.v)) {
    try {
      const cleaned = JSON.parse(JSON.stringify(doc.plan.v)) as Record<string, unknown>;
      writePlanPrefs(cleaned, readPlanPrefs(cleaned));
      validatePlanValue(cleaned);
      if (JSON.stringify(cleaned).length <= SYNC_LIMITS.maxPlanBytes) {
        out.plan = { m: cleanLwwTime(doc.plan), v: cleaned };
      }
    } catch {
      out.plan = null;
    }
  }
  if (doc.review) out.review = { m: cleanLwwTime(doc.review), v: doc.review.v === true };
  if (doc.active && (doc.active.v === null || okKey(doc.active.v))) {
    out.active = { m: cleanLwwTime(doc.active), v: doc.active.v };
  }
  for (const kind of ["wordBook", "blacklist"] as const) {
    const set = doc[kind] ?? emptySyncSet();
    out[kind] = {
      add: cleanTimedMap(set.add ?? dict<number>(), SYNC_LIMITS.maxSetItems),
      del: cleanTimedMap(set.del ?? dict<number>(), SYNC_LIMITS.maxSetItems),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Merge rules

/** Latest time this word was studied or changed (ms). */
export function syncWordActivityAt(word: SyncWord): number {
  return Math.max(word.lastSeenAt, word.introducedAt, word.m);
}

export function mergeSyncQuestion(a: SyncQuestion, b: SyncQuestion): SyncQuestion {
  const newer = b.l > a.l ? b : a.l > b.l ? a : b.s >= a.s ? b : a;
  return {
    s: Math.max(a.s, b.s),
    c: Math.max(a.c, b.c),
    l: newer.l,
    n: newer.n,
    p: newer.p,
  };
}

function minNonZero(a: number, b: number) {
  if (a <= 0) return b;
  if (b <= 0) return a;
  return Math.min(a, b);
}

/**
 * Per word: per question newer lastSeenAt wins (seen/correct max); earliest
 * introducedAt; union practiceDays; skipped / score / paperId follow the newer
 * `m`; counters and totalQuestions take the max.
 */
export function mergeSyncWord(a: SyncWord, b: SyncWord): SyncWord {
  const newer = b.m >= a.m ? b : a;
  const q = dict<SyncQuestion>();
  for (const id of keysOf(a.q)) q[id] = cloneQuestion(a.q[id]!);
  for (const id of keysOf(b.q)) {
    const existing = own(q, id);
    q[id] = existing ? mergeSyncQuestion(existing, b.q[id]!) : cloneQuestion(b.q[id]!);
  }
  const days = [...new Set([...a.days, ...b.days])].sort();
  return {
    m: Math.max(a.m, b.m),
    pid: newer.pid,
    score: newer.score,
    skipped: newer.skipped,
    totalQuestions: Math.max(a.totalQuestions, b.totalQuestions),
    correct: Math.max(a.correct, b.correct),
    seen: Math.max(a.seen, b.seen),
    sessions: Math.max(a.sessions, b.sessions),
    lastSeenAt: Math.max(a.lastSeenAt, b.lastSeenAt),
    introducedAt: minNonZero(a.introducedAt, b.introducedAt),
    introduced: a.introduced || b.introduced,
    days: days.length > SYNC_LIMITS.maxPracticeDays
      ? days.slice(days.length - SYNC_LIMITS.maxPracticeDays)
      : days,
    q,
  };
}

/**
 * Merge `inc` into a copy of `base`.
 * Times are whole minutes on the wire, so a reset / delete and a study in the
 * same minute tie. Ties keep the word (no study is ever lost); only words
 * last touched strictly before the reset / delete are dropped.
 */
export function mergeSyncCourse(base: SyncCourse, inc: SyncCourse, now = Date.now()): SyncCourse {
  const out = cloneSyncCourse(base);

  if (inc.resetAt > out.resetAt) {
    out.resetAt = inc.resetAt;
    for (const word of keysOf(out.words)) {
      if (syncWordActivityAt(out.words[word]!) < inc.resetAt) delete out.words[word];
    }
  }

  if (inc.m > out.m) {
    out.m = inc.m;
    out.placement = inc.placement ? { ...inc.placement } : null;
    out.seed = inc.seed;
  }
  out.bestStreak = Math.max(out.bestStreak, inc.bestStreak);

  for (const word of keysOf(inc.del)) {
    const at = inc.del[word]!;
    if (at > (own(out.del, word) ?? 0)) out.del[word] = at;
    const current = own(out.words, word);
    if (current && syncWordActivityAt(current) < at) delete out.words[word];
  }

  for (const word of keysOf(inc.words)) {
    const incoming = inc.words[word]!;
    const activity = syncWordActivityAt(incoming);
    if (activity < out.resetAt) continue;
    const tomb = own(out.del, word);
    if (tomb && activity < tomb) continue;
    const current = own(out.words, word);
    out.words[word] = current ? mergeSyncWord(current, incoming) : cloneSyncWord(incoming);
  }

  const cutoff = now - TOMBSTONE_TTL_MS;
  for (const word of keysOf(out.del)) {
    const at = out.del[word]!;
    if (at <= out.resetAt || at < cutoff || own(out.words, word)) delete out.del[word];
  }
  return out;
}

export function mergeSyncSet(base: SyncSet, inc: SyncSet, now = Date.now()): SyncSet {
  const out = cloneSet(base);
  for (const key of keysOf(inc.add)) {
    if (inc.add[key]! > (own(out.add, key) ?? 0)) out.add[key] = inc.add[key]!;
  }
  for (const key of keysOf(inc.del)) {
    if (inc.del[key]! > (own(out.del, key) ?? 0)) out.del[key] = inc.del[key]!;
  }
  const cutoff = now - TOMBSTONE_TTL_MS;
  for (const key of keysOf(out.del)) {
    const added = own(out.add, key) ?? 0;
    const removed = out.del[key]!;
    // Same-minute add / remove: keep the item (never lose a word-book entry).
    if (added >= removed) {
      delete out.del[key];
    } else {
      delete out.add[key];
      if (removed < cutoff) delete out.del[key];
    }
  }
  return out;
}

/** Last writer wins; on a tie the existing value stays. */
export function mergeSyncLww<T>(a: SyncLww<T> | null, b: SyncLww<T> | null): SyncLww<T> | null {
  if (!b) return a;
  if (!a) return b;
  return b.m > a.m ? b : a;
}

/**
 * App settings ride inside the study-plan object (no new top-level field, so
 * apps that only know schema 1 still decode the document). Bags of primitives:
 *   _s / _s2 / …  key → value     _m / _m2 / …  key → minute-stamp
 * Missing bags are kept from the other side, so an older app uploading a plan
 * cannot wipe settings it doesn't know about. Each key is last-writer-wins on
 * its own stamp; a tie keeps the existing value.
 */
const PREF_BAG_COUNT = 4;
const PREF_BAG_SIZE = 30;

function prefValueBag(index: number) {
  return index === 0 ? "_s" : `_s${index + 1}`;
}
function prefTimeBag(index: number) {
  return index === 0 ? "_m" : `_m${index + 1}`;
}

export function isPrefBagKey(key: string) {
  for (let i = 0; i < PREF_BAG_COUNT; i++) {
    if (key === prefValueBag(i) || key === prefTimeBag(i)) return true;
  }
  return false;
}

export type PrefValue = string | number | boolean;
export type PrefEntry = { m: number; v: PrefValue };

function asPrefValue(value: unknown): PrefValue | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.length <= 200 ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function readBag(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/** Settings carried on a plan object. Unknown keys included; bad values dropped. */
export function readPlanPrefs(plan: Record<string, unknown> | null | undefined): Record<string, PrefEntry> {
  const out: Record<string, PrefEntry> = {};
  if (!plan) return out;
  for (let i = 0; i < PREF_BAG_COUNT; i++) {
    const values = readBag(plan[prefValueBag(i)]);
    const times = readBag(plan[prefTimeBag(i)]);
    for (const key of Object.keys(values)) {
      if (key.length === 0 || key.length > 40) continue;
      const v = asPrefValue(values[key]);
      const m = Number(times[key]);
      if (v === null || !Number.isFinite(m) || m <= 0) continue;
      out[key] = { m, v };
    }
  }
  return out;
}

/** Write settings back onto a plan object (replaces any previous bags). */
export function writePlanPrefs(plan: Record<string, unknown>, prefs: Record<string, PrefEntry>) {
  for (let i = 0; i < PREF_BAG_COUNT; i++) {
    delete plan[prefValueBag(i)];
    delete plan[prefTimeBag(i)];
  }
  const keys = Object.keys(prefs).sort();
  for (let i = 0; i < keys.length && i < PREF_BAG_COUNT * PREF_BAG_SIZE; i++) {
    const bag = Math.floor(i / PREF_BAG_SIZE);
    const key = keys[i]!;
    const entry = prefs[key]!;
    const values = (plan[prefValueBag(bag)] ??= Object.create(null)) as Record<string, PrefValue>;
    const times = (plan[prefTimeBag(bag)] ??= Object.create(null)) as Record<string, number>;
    values[key] = entry.v;
    times[key] = entry.m;
  }
}

function mergePrefEntries(
  base: Record<string, PrefEntry>,
  inc: Record<string, PrefEntry>,
): Record<string, PrefEntry> {
  // Patch, not per-key last-writer-wins: keys in this upload replace those
  // keys; keys the upload doesn't mention stay. An older app that sends no
  // bags at all therefore cannot wipe settings.
  const out: Record<string, PrefEntry> = { ...base };
  for (const key of Object.keys(inc)) out[key] = inc[key]!;
  return out;
}

/**
 * What turning sync on should do with settings.
 * No settings on the cloud yet → upload this device's settings once.
 * Cloud already has settings → this device takes the cloud copy as-is.
 */
export function settingsEnableAction(cloudHasSettings: boolean): "upload" | "overwrite" {
  return cloudHasSettings ? "overwrite" : "upload";
}

/**
 * Study-plan fields: last writer wins, as before.
 * Settings: a patch on top of whatever is already stored. A plan update that
 * doesn't mention settings leaves them untouched.
 */
export function mergePlanWithPrefs(
  base: SyncLww<Record<string, unknown>> | null,
  inc: SyncLww<Record<string, unknown>> | null,
): SyncLww<Record<string, unknown>> | null {
  const winner = mergeSyncLww(base, inc);
  if (!winner) return null;
  const v = { ...winner.v };
  const prefs = mergePrefEntries(readPlanPrefs(base?.v), readPlanPrefs(inc?.v));
  writePlanPrefs(v, prefs);
  const loser = winner === inc ? base : inc;
  if (loser?.v) {
    for (const key of Object.keys(loser.v)) {
      if (isPrefBagKey(key)) continue;
      if (!Object.prototype.hasOwnProperty.call(v, key)) v[key] = loser.v[key]!;
    }
  }
  return { m: winner.m, v };
}

/** Server-side (and client-side) merge of an incoming delta / snapshot. */
export function mergeSyncDoc(base: SyncDoc, inc: SyncDoc, now = Date.now()): SyncDoc {
  const out = cloneSyncDoc(base);
  for (const id of keysOf(inc.courses)) {
    const current = own(out.courses, id) ?? emptySyncCourse();
    out.courses[id] = mergeSyncCourse(current, inc.courses[id]!, now);
  }
  out.plan = mergePlanWithPrefs(out.plan, inc.plan);
  out.review = mergeSyncLww(out.review, inc.review);
  out.active = mergeSyncLww(out.active, inc.active);
  out.wordBook = mergeSyncSet(out.wordBook, inc.wordBook, now);
  out.blacklist = mergeSyncSet(out.blacklist, inc.blacklist, now);
  return cloneSyncDoc(decodeSyncDoc(encodeSyncDoc(sanitizeSyncDoc(out))));
}

export function syncDocWordCount(doc: SyncDoc): number {
  let total = 0;
  for (const id of keysOf(doc.courses)) total += keysOf(doc.courses[id]!.words).length;
  return total;
}

/** Items present in a set (added, and not removed in a later minute). */
export function syncSetItems(set: SyncSet): string[] {
  return keysOf(set.add).filter((key) => (own(set.del, key) ?? 0) <= set.add[key]!);
}
