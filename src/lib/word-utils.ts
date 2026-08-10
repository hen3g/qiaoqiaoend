export type WordItem = {
  en: string;
  zh: string;
};

/** 解析用户粘贴的单词：支持逗号、顿号、换行、空格分隔；可选 "en/中文" 或 "en 中文" */
export function parseUserWords(raw: string): WordItem[] {
  const parts = raw
    .split(/[,，、;\n\r\t]+|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: WordItem[] = [];

  for (const part of parts) {
    let en = "";
    let zh = "";

    const slash = part.match(/^([a-zA-Z][a-zA-Z'\-\s]{0,40})\s*[\/／]\s*(.+)$/);
    const spaced = part.match(/^([a-zA-Z][a-zA-Z'\-\s]{0,40})\s+([\u4e00-\u9fff].*)$/);
    if (slash) {
      en = slash[1]!.trim();
      zh = slash[2]!.trim();
    } else if (spaced) {
      en = spaced[1]!.trim();
      zh = spaced[2]!.trim();
    } else if (/^[a-zA-Z][a-zA-Z'\-\s]{0,40}$/.test(part)) {
      en = part.trim();
    } else {
      // 纯中文或杂项跳过；单空格分隔的多个英文词再拆
      const words = part.split(/\s+/).filter((w) => /^[a-zA-Z][a-zA-Z'\-]{0,30}$/.test(w));
      for (const w of words) {
        const key = w.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ en: key, zh: "" });
      }
      continue;
    }

    const key = en.toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ en: key, zh });
  }

  return result;
}

export function mergeWords(base: WordItem[], incoming: WordItem[]): WordItem[] {
  const map = new Map(base.map((w) => [w.en.toLowerCase(), w]));
  for (const w of incoming) {
    const key = w.en.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { en: key, zh: w.zh });
    } else if (!prev.zh && w.zh) {
      map.set(key, { en: key, zh: w.zh });
    }
  }
  return Array.from(map.values());
}

export type SuggestedWordsResult = {
  theme: string;
  difficulty: number;
  words: WordItem[];
};

function extractSuggestedWordsList(data: unknown): WordItem[] {
  const list = Array.isArray(data)
    ? data
    : (data as { words?: unknown }).words;

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("AI 没有返回可用单词");
  }

  const seen = new Set<string>();
  const words: WordItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const en = String(row.en ?? row.word ?? "")
      .trim()
      .toLowerCase();
    if (!en || !/^[a-z][a-z'\-\s]{0,40}$/.test(en)) continue;
    const key = en.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    words.push({ en: key, zh: String(row.zh ?? row.meaning ?? "").trim() });
  }

  if (words.length === 0) {
    throw new Error("AI 返回的单词无法解析");
  }
  return words;
}

function parseSuggestJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim()
    ?? (trimmed.includes("{")
      ? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1)
      : trimmed);

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("AI 返回的单词列表不是有效 JSON");
  }
}

export function parseSuggestedWordsResult(
  raw: string,
  fallbackTheme = "",
): SuggestedWordsResult {
  const data = parseSuggestJson(raw);
  const words = extractSuggestedWordsList(data);
  const obj = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
  const theme = String(obj.theme ?? "").trim() || fallbackTheme || "自定义词汇";
  const difficulty = Math.min(
    5,
    Math.max(1, Math.round(Number(obj.difficulty) || 2)),
  );
  return { theme, difficulty, words };
}

export function parseSuggestedWords(raw: string): WordItem[] {
  return parseSuggestedWordsResult(raw).words;
}
