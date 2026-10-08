import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import {
  decodeQuestionId,
  decodeSyncDoc,
  decodeSyncDocJson,
  emptySyncCourse,
  emptySyncDoc,
  encodeQuestionId,
  encodeSyncDoc,
  encodeSyncDocJson,
  mergeSyncCourse,
  mergeSyncDoc,
  readPlanPrefs,
  settingsEnableAction,
  writePlanPrefs,
  mergeSyncSet,
  mergeSyncWord,
  roundSyncTime,
  sanitizeSyncDoc,
  SyncCodecError,
  syncSetItems,
  type SyncCourse,
  type SyncDoc,
  type SyncWord,
} from "./learn-sync-codec";

const T0 = Date.UTC(2026, 9, 8, 1, 2, 3, 456);
const MIN = 60_000;
const DAY = 86_400_000;
// Widened to string so TS indexes the record instead of Object.prototype.constructor.
const CTOR: string = "constructor";

function word(partial: Partial<SyncWord> = {}): SyncWord {
  return {
    m: T0,
    pid: null,
    score: 25,
    correct: 3,
    seen: 4,
    sessions: 1,
    lastSeenAt: T0,
    introducedAt: T0 - 3 * DAY,
    totalQuestions: 6,
    introduced: true,
    skipped: false,
    days: ["2026-10-05", "2026-10-08"],
    q: Object.assign(Object.create(null), {
      "apple-choice": { s: 2, c: 1, l: T0, n: T0 + 3 * DAY, p: false },
      "apple-zh": { s: 1, c: 0, l: T0 - 5 * MIN, n: 0, p: true },
      "apple-listen-spell": { s: 1, c: 1, l: T0 - DAY, n: T0 + 6 * DAY, p: false },
      "apple-cloze": { s: 0, c: 0, l: 0, n: T0 + DAY, p: false },
    }),
    ...partial,
  };
}

function sampleDoc(): SyncDoc {
  const doc = emptySyncDoc();
  const course = emptySyncCourse();
  course.m = T0;
  course.bestStreak = 12;
  course.placement = { estimatedSize: 3200, startRank: 1500, completedAt: T0 - 10 * DAY };
  course.seed = 123456789;
  course.words.apple = word();
  course.words["a can opener"] = word({
    lastSeenAt: T0 - 2 * DAY,
    m: T0 - 2 * DAY,
    q: Object.assign(Object.create(null), {
      "a-can-opener-en2zh": { s: 1, c: 1, l: T0 - 2 * DAY, n: T0 + DAY, p: false },
      "weird id": { s: 1, c: 1, l: T0 - 2 * DAY, n: 0, p: false },
    }),
  });
  course.words["aren't"] = word({ q: Object.assign(Object.create(null), {
    "aren't-trans": { s: 1, c: 1, l: T0, n: T0 + DAY, p: false },
  }) });
  course.words[CTOR] = word({ pid: "paper-7", skipped: true, introducedAt: 0, days: [] });
  course.words.old = word({ lastSeenAt: 0, m: 0, introducedAt: 0, introduced: false, days: [], q: Object.create(null) });
  course.del.removed = T0 - DAY;
  doc.courses.oxford5000 = course;
  doc.courses.cet4 = emptySyncCourse();
  doc.courses.cet4.resetAt = T0 - 7 * DAY;
  doc.plan = { m: T0, v: { sessionWords: 25, dailyNewWords: 40, reviewDays: [1, 3, 7], learnTypes: ["zh_to_en", "choice"] } };
  doc.review = { m: T0 - MIN, v: false };
  doc.active = { m: T0, v: "oxford5000" };
  doc.wordBook.add.apple = T0;
  doc.wordBook.del.pear = T0 - DAY;
  doc.blacklist.add.the = 1;
  return doc;
}

test("question id compression round-trips", () => {
  const cases: [string, string][] = [
    ["apple", "apple-choice"],
    ["a can opener", "a-can-opener-zh"],
    ["aren't", "aren't-trans"],
    ["Apple", "Apple-listen-spell"],
    ["o'clock", "o-clock-zh-speak"],
    ["apple", "apple-cloze-3"],
    ["apple", "something-else"],
    ["apple", "=odd"],
    ["", "-zh"],
  ];
  for (const [w, id] of cases) {
    const key = encodeQuestionId(w, id);
    assert.equal(decodeQuestionId(w, key), id, `${w} / ${id} via ${String(key)}`);
  }
  assert.equal(typeof encodeQuestionId("apple", "apple-choice"), "number");
});

test("encode/decode round-trip keeps data at minute precision", () => {
  const doc = sampleDoc();
  const once = encodeSyncDocJson(doc);
  const decoded = decodeSyncDocJson(once);
  // Re-encoding a decoded doc is stable.
  assert.equal(encodeSyncDocJson(decoded), once);
  const apple = decoded.courses.oxford5000!.words.apple!;
  assert.equal(apple.lastSeenAt, roundSyncTime(T0));
  assert.equal(apple.introducedAt, roundSyncTime(T0 - 3 * DAY));
  assert.equal(apple.q["apple-choice"]!.n, roundSyncTime(T0 + 3 * DAY));
  assert.equal(apple.q["apple-zh"]!.p, true);
  assert.equal(apple.q["apple-cloze"]!.l, 0);
  assert.equal(apple.q["apple-cloze"]!.n, roundSyncTime(T0 + DAY));
  assert.deepEqual(apple.days, ["2026-10-05", "2026-10-08"]);
  const ctor = decoded.courses.oxford5000!.words[CTOR]!;
  assert.equal(ctor.pid, "paper-7");
  assert.equal(ctor.skipped, true);
  assert.equal(ctor.introducedAt, 0);
  const old = decoded.courses.oxford5000!.words.old!;
  assert.equal(old.introduced, false);
  assert.equal(old.lastSeenAt, 0);
  assert.equal(decoded.courses.oxford5000!.placement!.startRank, 1500);
  assert.equal(decoded.courses.oxford5000!.seed, 123456789);
  assert.equal(decoded.courses.oxford5000!.del.removed, roundSyncTime(T0 - DAY));
  assert.equal(decoded.courses.cet4!.resetAt, roundSyncTime(T0 - 7 * DAY));
  assert.deepEqual(decoded.plan!.v, doc.plan!.v);
  assert.equal(decoded.review!.v, false);
  assert.equal(decoded.active!.v, "oxford5000");
  assert.deepEqual(syncSetItems(decoded.wordBook), ["apple"]);
  assert.deepEqual(syncSetItems(decoded.blacklist), ["the"]);
  assert.equal(
    decoded.courses["a can opener"] ?? null,
    null,
  );
  assert.deepEqual(
    Object.keys(decoded.courses.oxford5000!.words["a can opener"]!.q).sort(),
    ["a-can-opener-en2zh", "weird id"],
  );
});

test("decode rejects malformed input", () => {
  const bad: unknown[] = [
    null,
    [2, []],
    [1, [["c", 0, 0, 0, 0, 0, [["w", "x"]], []]], 0, 0, 0, 0, 0],
    [1, [["c", 0, -1, 0, 0, 0, [], []]], 0, 0, 0, 0, 0],
    [1, [], [1, "not-object"], 0, 0, 0, 0],
    [1, [["c", 0, 0, 0, 0, 0, [["w", 1, null, 1, 0, 0, 0, 0, 0, null, [], [[99]]]], []]], 0, 0, 0, 0, 0],
  ];
  for (const raw of bad) {
    assert.throws(() => decodeSyncDoc(raw), SyncCodecError, JSON.stringify(raw));
  }
});

test("question merge: newer lastSeenAt wins, seen/correct take max", () => {
  const a = word({ m: T0 });
  const b = word({
    m: T0 + DAY,
    score: 5,
    q: Object.assign(Object.create(null), {
      "apple-choice": { s: 1, c: 1, l: T0 + DAY, n: T0 + 8 * DAY, p: false },
      "apple-zh": { s: 3, c: 1, l: T0 - DAY, n: 0, p: false },
      "apple-trans": { s: 1, c: 0, l: T0 + DAY, n: 0, p: true },
    }),
  });
  const merged = mergeSyncWord(a, b);
  const choice = merged.q["apple-choice"]!;
  assert.deepEqual(choice, { s: 2, c: 1, l: T0 + DAY, n: T0 + 8 * DAY, p: false });
  const zh = merged.q["apple-zh"]!; // a is newer for this question
  assert.equal(zh.p, true);
  assert.equal(zh.l, T0 - 5 * MIN);
  assert.equal(zh.s, 3);
  assert.equal(merged.q["apple-trans"]!.p, true);
  assert.equal(merged.q["apple-listen-spell"]!.s, 1);
  assert.equal(merged.score, 5); // newer m
  assert.equal(merged.m, T0 + DAY);
});

test("word merge: earliest introducedAt, union days, skipped/score follow newer m", () => {
  const a = word({ introducedAt: T0 - 9 * DAY, days: ["2026-09-29"], skipped: true, score: 90, m: T0 + 2 * DAY });
  const b = word({ introducedAt: T0 - 3 * DAY, days: ["2026-10-08", "2026-09-29"], skipped: false, score: 10, m: T0 });
  const merged = mergeSyncWord(a, b);
  assert.equal(merged.introducedAt, T0 - 9 * DAY);
  assert.deepEqual(merged.days, ["2026-09-29", "2026-10-08"]);
  assert.equal(merged.skipped, true);
  assert.equal(merged.score, 90);
  const zeroIntro = mergeSyncWord(word({ introducedAt: 0 }), word({ introducedAt: T0 }));
  assert.equal(zeroIntro.introducedAt, T0);
});

test("tombstones only apply when newer than the other side's last study", () => {
  const base = emptySyncCourse();
  base.words.apple = word({ lastSeenAt: T0, m: T0, introducedAt: T0 - DAY });
  base.words.pear = word({ lastSeenAt: T0 - 5 * DAY, m: T0 - 5 * DAY, introducedAt: T0 - 6 * DAY });
  const inc = emptySyncCourse();
  inc.del.apple = T0 - DAY; // older than apple's last study → ignored
  inc.del.pear = T0 - DAY; // newer than pear's last study → delete
  const merged = mergeSyncCourse(base, inc, T0);
  assert.ok(merged.words.apple);
  assert.equal(merged.words.pear, undefined);
  assert.equal(merged.del.pear, T0 - DAY);
  assert.equal(merged.del.apple, undefined); // surviving word clears the stale tombstone

  // A stale copy of a deleted word arriving later is dropped.
  const stale = emptySyncCourse();
  stale.words.pear = word({ lastSeenAt: T0 - 5 * DAY, m: T0 - 4 * DAY, introducedAt: T0 - 6 * DAY });
  const again = mergeSyncCourse(merged, stale, T0);
  assert.equal(again.words.pear, undefined);

  // Studying it after the deletion brings it back.
  const fresh = emptySyncCourse();
  fresh.words.pear = word({ lastSeenAt: T0, m: T0 });
  const back = mergeSyncCourse(merged, fresh, T0);
  assert.ok(back.words.pear);
  assert.equal(back.del.pear, undefined);
});

test("course reset drops older words on both sides; meta is last-writer-wins", () => {
  const base = emptySyncCourse();
  base.m = T0 - DAY;
  base.placement = { estimatedSize: 100, startRank: 50, completedAt: T0 - DAY };
  base.bestStreak = 30;
  base.words.apple = word({ lastSeenAt: T0 - 2 * DAY, m: T0 - 2 * DAY, introducedAt: T0 - 3 * DAY });
  base.words.kiwi = word({ lastSeenAt: T0 + DAY, m: T0 + DAY });
  const reset = emptySyncCourse();
  reset.resetAt = T0;
  reset.m = T0;
  reset.placement = null;
  reset.bestStreak = 2;
  const merged = mergeSyncCourse(base, reset, T0);
  assert.equal(merged.words.apple, undefined);
  assert.ok(merged.words.kiwi);
  assert.equal(merged.placement, null);
  assert.equal(merged.bestStreak, 30);
  // An older device pushing pre-reset words loses them.
  const older = emptySyncCourse();
  older.words.apple = word({ lastSeenAt: T0 - MIN, m: T0 - MIN, introducedAt: T0 - DAY });
  older.m = T0 - 2 * DAY;
  older.placement = { estimatedSize: 1, startRank: 1, completedAt: 1 };
  const after = mergeSyncCourse(merged, older, T0);
  assert.equal(after.words.apple, undefined);
  assert.equal(after.placement, null); // older meta ignored
  // A delta without meta (m=0) never touches placement.
  const wordsOnly = emptySyncCourse();
  wordsOnly.words.plum = word({ lastSeenAt: T0 + DAY, m: T0 + DAY });
  assert.equal(mergeSyncCourse(base, wordsOnly, T0).placement!.startRank, 50);
});

test("sets: add/remove last-writer-wins with tombstones", () => {
  const base = { add: Object.assign(Object.create(null), { a: T0, b: T0 }), del: Object.create(null) };
  const inc = {
    add: Object.assign(Object.create(null), { c: T0 + MIN }),
    del: Object.assign(Object.create(null), { a: T0 + MIN, b: T0 - MIN }),
  };
  const merged = mergeSyncSet(base, inc, T0);
  assert.deepEqual(syncSetItems(merged).sort(), ["b", "c"]);
  assert.equal(merged.del.a, T0 + MIN);
  // Re-adding later wins over the tombstone.
  const readd = mergeSyncSet(merged, { add: Object.assign(Object.create(null), { a: T0 + 2 * MIN }), del: Object.create(null) }, T0);
  assert.deepEqual(syncSetItems(readd).sort(), ["a", "b", "c"]);
});

test("doc merge is idempotent and plan/settings are last-writer-wins", () => {
  const base = sampleDoc();
  const delta = emptySyncDoc();
  delta.review = { m: T0 + MIN, v: true };
  delta.plan = { m: T0 - DAY, v: { sessionWords: 5 } };
  delta.courses.oxford5000 = emptySyncCourse();
  delta.courses.oxford5000.words.banana = word({ m: T0 + MIN, lastSeenAt: T0 + MIN });
  const once = mergeSyncDoc(base, delta, T0);
  const twice = mergeSyncDoc(once, delta, T0);
  assert.equal(encodeSyncDocJson(once), encodeSyncDocJson(twice));
  assert.equal(once.review!.v, true);
  assert.equal(once.plan!.v.sessionWords, 25);
  assert.ok(once.courses.oxford5000!.words.banana);
  assert.equal(once.courses.oxford5000!.bestStreak, 12);
});

test("size: 5000 studied words stay well under the caps", () => {
  const doc = emptySyncDoc();
  const course = emptySyncCourse();
  for (let i = 0; i < 5000; i += 1) {
    const w = `word${i}`;
    const at = T0 - (i % 300) * DAY - i * MIN;
    const q = Object.create(null);
    for (const s of ["zh", "listen", "choice", "cloze", "en2zh", "trans"]) {
      q[`${w}-${s}`] = { s: 2, c: 1, l: at, n: at + 7 * DAY, p: false };
    }
    course.words[w] = word({ lastSeenAt: at, m: at, introducedAt: at - 3 * DAY, days: ["2026-01-02", "2026-02-03"], q });
  }
  doc.courses.oxford5000 = course;
  const json = JSON.stringify(encodeSyncDoc(doc));
  const gz = gzipSync(new TextEncoder().encode(json));
  console.log(`5000 words: raw ${json.length} B, gzip ${gz.length} B`);
  assert.ok(json.length < 8 * 1024 * 1024);
  assert.ok(gz.length < 1024 * 1024);
  const verbose = JSON.stringify(course.words);
  console.log(`  (AsyncStorage-style JSON for same data: ${verbose.length} B)`);
});

/** What the server sees: the doc after a trip over the wire (minute precision). */
function wire(doc: SyncDoc): SyncDoc {
  return decodeSyncDocJson(encodeSyncDocJson(doc));
}

function courseDoc(id: string, course: SyncCourse): SyncDoc {
  const doc = emptySyncDoc();
  doc.courses[id] = course;
  return doc;
}

test("same-minute ties keep the data: reset/delete then study in the same minute", () => {
  const minute = Date.UTC(2026, 9, 8, 2, 0, 0);
  // Reset at :05, study at :40 of the same minute → both round to the same minute.
  const delta = emptySyncCourse();
  delta.resetAt = minute + 5_000;
  delta.words.apple = word({ lastSeenAt: minute + 40_000, m: minute + 40_000, introducedAt: minute + 40_000 });
  const server = emptySyncDoc();
  const before = emptySyncCourse();
  before.words.old = word({ lastSeenAt: minute - 2 * MIN, m: minute - 2 * MIN, introducedAt: minute - DAY });
  server.courses.c = before;
  const merged = mergeSyncDoc(wire(server), wire(courseDoc("c", delta)), minute);
  assert.ok(merged.courses.c!.words.apple, "word studied right after a reset must survive");
  assert.equal(merged.courses.c!.words.old, undefined, "words before the reset are dropped");

  // Delete and re-study in the same minute (two separate uploads).
  const del = emptySyncCourse();
  del.del.apple = minute + 50_000;
  const afterDel = mergeSyncDoc(merged, wire(courseDoc("c", del)), minute);
  assert.ok(afterDel.courses.c!.words.apple, "same-minute delete does not beat a same-minute study");
  const laterDel = emptySyncCourse();
  laterDel.del.apple = minute + 2 * MIN;
  assert.equal(mergeSyncDoc(merged, wire(courseDoc("c", laterDel)), minute).courses.c!.words.apple, undefined);

  // Word book: add and remove in the same minute keeps the word.
  const set = mergeSyncSet(
    { add: Object.assign(Object.create(null), { pear: roundSyncTime(minute + 1_000) }), del: Object.create(null) },
    { add: Object.create(null), del: Object.assign(Object.create(null), { pear: roundSyncTime(minute + 30_000) }) },
    minute,
  );
  assert.deepEqual(syncSetItems(set), ["pear"]);
});

test("first enable on a second device merges both devices (no overwrite)", () => {
  const tA = Date.UTC(2026, 9, 1);
  // Device A uploaded its progress + a customised plan earlier.
  const a = emptySyncDoc();
  const ca = emptySyncCourse();
  ca.words.apple = word({ lastSeenAt: tA, m: tA, seen: 9, correct: 7 });
  ca.words.both = word({ lastSeenAt: tA, m: tA, seen: 2 });
  a.courses.cet4 = ca;
  a.plan = { m: tA, v: { sessionWords: 30 } };
  a.wordBook.add.alpha = tA;
  const server = mergeSyncDoc(emptySyncDoc(), wire(a), tA);

  // Device B (anonymous / never synced) turns sync on: full upload, plan stamped 1.
  const tB = Date.UTC(2026, 9, 8);
  const b = emptySyncDoc();
  const cb = emptySyncCourse();
  cb.words.kiwi = word({ lastSeenAt: tB, m: tB, seen: 3 });
  cb.words.both = word({ lastSeenAt: tB, m: tB, seen: 5 });
  b.courses.cet4 = cb;
  const cb2 = emptySyncCourse();
  cb2.words.zebra = word({ lastSeenAt: tB, m: tB });
  b.courses.oxford5000 = cb2;
  b.plan = { m: 1, v: { sessionWords: 10 } };
  b.wordBook.add.beta = tB;
  const merged = mergeSyncDoc(server, wire(b), tB);

  assert.deepEqual(Object.keys(merged.courses.cet4!.words).sort(), ["apple", "both", "kiwi"]);
  assert.ok(merged.courses.oxford5000!.words.zebra);
  assert.equal(merged.courses.cet4!.words.apple!.seen, 9);
  assert.equal(merged.courses.cet4!.words.both!.seen, 5);
  assert.equal(merged.plan!.v.sessionWords, 30, "existing cloud plan wins over a first-enable plan");
  assert.deepEqual(syncSetItems(merged.wordBook).sort(), ["alpha", "beta"]);

  // Empty cloud: the first-enable plan is kept.
  assert.equal(mergeSyncDoc(emptySyncDoc(), wire(b), tB).plan!.v.sessionWords, 10);
});

test("edge values: pre-2024 dates, special-char words, unknown question types", () => {
  const doc = emptySyncDoc();
  const c = emptySyncCourse();
  const old = Date.UTC(2023, 5, 1);
  c.words["café au lait"] = word({ lastSeenAt: old, m: old, introducedAt: old, days: ["2023-06-01"], q: Object.create(null) });
  for (const w of ["o'clock", "naïve", "__proto__", "hasOwnProperty", "a/b-c", "日本", "🙂"]) {
    c.words[w] = word({ q: Object.create(null) });
  }
  c.words.apple = word({
    q: Object.assign(Object.create(null), {
      "apple-future-type-3": { s: 1, c: 1, l: T0, n: T0 + DAY, p: false },
    }),
  });
  doc.courses.cet4 = c;
  doc.courses.cet6 = emptySyncCourse();
  doc.courses.cet6.words.apple = word({ seen: 1, q: Object.create(null) });
  const back = wire(doc);
  const words = back.courses.cet4!.words;
  for (const w of ["café au lait", "o'clock", "naïve", "__proto__", "hasOwnProperty", "a/b-c", "日本", "🙂", "apple"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(words, w), w);
  }
  // Before the sync epoch: clamped to 2024-01-01 (already in the past), days kept exactly.
  assert.equal(words["café au lait"]!.lastSeenAt, Date.UTC(2024, 0, 1));
  assert.deepEqual(words["café au lait"]!.days, ["2023-06-01"]);
  // Unknown (newer app) question types survive the round-trip verbatim.
  assert.ok(words.apple!.q["apple-future-type-3"]);
  // Same word in two courses stays independent.
  assert.equal(back.courses.cet6!.words.apple!.seen, 1);
  assert.equal(words.apple!.seen, 4);
  // Review times are floored to the minute: at most 59 s early, never late.
  const n = T0 + 3 * DAY + 59_999;
  const r = roundSyncTime(n);
  assert.ok(r <= n && n - r < MIN);
});

test("sanitize: one bad value never makes the whole doc undecodable", () => {
  const doc = emptySyncDoc();
  const c = emptySyncCourse();
  c.placement = { estimatedSize: Number.NaN, startRank: 0, completedAt: T0 };
  c.seed = -5;
  c.words["x".repeat(200)] = word();
  c.words[""] = word();
  c.words.ok = word({
    score: Number.NaN,
    seen: -3,
    correct: 2.6,
    days: ["2026-02-30", "not-a-day", "2026-10-08", "2026-10-08"],
    pid: "p".repeat(300),
    q: Object.assign(Object.create(null), { ["q".repeat(400)]: { s: 1, c: 1, l: T0, n: 0, p: false } }),
  });
  c.del["y".repeat(500)] = T0;
  c.del.zero = 0;
  doc.courses.cet4 = c;
  doc.courses["z".repeat(300)] = emptySyncCourse();
  doc.plan = { m: T0, v: { deep: { deeper: { deepest: { tooDeep: 1 } } } } };
  doc.active = { m: T0, v: "a".repeat(400) };
  doc.wordBook.add["w".repeat(400)] = T0;
  doc.wordBook.add.fine = T0;
  assert.throws(() => decodeSyncDocJson(encodeSyncDocJson(doc)), SyncCodecError);
  const clean = sanitizeSyncDoc(doc);
  const back = wire(clean);
  assert.deepEqual(Object.keys(back.courses), ["cet4"]);
  const okWord = back.courses.cet4!.words.ok!;
  assert.deepEqual(Object.keys(back.courses.cet4!.words), ["ok"]);
  assert.equal(okWord.score, 0);
  assert.equal(okWord.seen, 0);
  assert.equal(okWord.correct, 3);
  assert.deepEqual(okWord.days, ["2026-10-08"]);
  assert.equal(okWord.pid, null);
  assert.deepEqual(Object.keys(okWord.q), []);
  assert.equal(back.courses.cet4!.placement!.startRank, 1);
  assert.equal(back.courses.cet4!.seed, null);
  assert.deepEqual(Object.keys(back.courses.cet4!.del), []);
  assert.equal(back.plan, null);
  assert.equal(back.active, null);
  assert.deepEqual(syncSetItems(back.wordBook), ["fine"]);
  // Sanitizing valid data changes nothing.
  const sample = sampleDoc();
  assert.equal(encodeSyncDocJson(sanitizeSyncDoc(sample)), encodeSyncDocJson(sample));
});

test("schema version: a newer doc is rejected, not misread", () => {
  const raw = encodeSyncDoc(sampleDoc());
  raw[0] = 2;
  assert.throws(() => decodeSyncDoc(raw), SyncCodecError);
});

test("settings: enable uploads once when the cloud has none, otherwise the cloud copy wins", () => {
  assert.equal(settingsEnableAction(false), "upload");
  assert.equal(settingsEnableAction(true), "overwrite");
});

test("settings: patch update, unknown keys kept, missing key not wiped, round trip", () => {
  const base = emptySyncDoc();
  base.plan = {
    m: Date.UTC(2026, 0, 1),
    v: {
      sessionWords: 20,
      _s: { locale: "ja", theme: "dark", futureThing: "keep-me" },
      _m: { locale: 1, theme: 1, futureThing: 1 },
    },
  };
  // Newer study plan, and only `theme` changed. An older minute must still win:
  // this is a patch, not per-key last-writer-wins.
  const inc = emptySyncDoc();
  inc.plan = {
    m: Date.UTC(2026, 0, 2),
    v: {
      sessionWords: 30,
      _s: { theme: "light" },
      _m: { theme: 1 },
    },
  };
  const merged = mergeSyncDoc(base, inc);
  assert.equal(merged.plan!.v.sessionWords, 30);
  const prefs = readPlanPrefs(merged.plan!.v);
  assert.equal(prefs.theme!.v, "light");
  assert.equal(prefs.locale!.v, "ja", "key the update didn't mention stays");
  assert.equal(prefs.futureThing!.v, "keep-me", "unknown future key stays");

  const again = decodeSyncDocJson(encodeSyncDocJson(merged));
  assert.equal(readPlanPrefs(again.plan!.v).futureThing!.v, "keep-me");

  // An older app uploading a plan with no settings bags must not wipe them.
  const oldApp = emptySyncDoc();
  oldApp.plan = { m: Date.UTC(2026, 0, 3), v: { sessionWords: 10 } };
  const kept = mergeSyncDoc(again, oldApp);
  assert.equal(kept.plan!.v.sessionWords, 10);
  assert.equal(readPlanPrefs(kept.plan!.v).locale!.v, "ja");
  assert.equal(readPlanPrefs(kept.plan!.v).futureThing!.v, "keep-me");

  const fresh = emptySyncDoc();
  fresh.plan = { m: 1, v: { sessionWords: 20 } };
  writePlanPrefs(fresh.plan.v, { locale: { m: 1, v: "zh" }, accent: { m: 1, v: "amber" } });
  const wired = decodeSyncDocJson(encodeSyncDocJson(fresh));
  assert.deepEqual(
    Object.keys(readPlanPrefs(wired.plan!.v)).sort(),
    ["accent", "locale"],
  );
});
