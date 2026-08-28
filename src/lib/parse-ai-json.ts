import { jsonrepair } from "jsonrepair";

/** 从 AI 回复中提取 JSON（支持 ```json 代码块；截断时也从首个括号起取） */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objStart = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const startsWithArray =
    arrStart >= 0 && (objStart < 0 || arrStart < objStart);

  if (startsWithArray) {
    const end = trimmed.lastIndexOf("]");
    return trimmed.slice(arrStart, end > arrStart ? end + 1 : undefined);
  }
  if (objStart >= 0) {
    const end = trimmed.lastIndexOf("}");
    return trimmed.slice(objStart, end > objStart ? end + 1 : undefined);
  }
  return trimmed;
}

/**
 * 解析 AI 返回的 JSON。若语法不合法（尾逗号、缺括号、键未加引号等），
 * 先用 jsonrepair 修好再 parse。
 */
export function parseJsonWithRepair(raw: string): unknown {
  const text = extractJsonText(raw);
  try {
    return JSON.parse(text);
  } catch {
    // fall through to repair
  }

  try {
    return JSON.parse(jsonrepair(text));
  } catch {
    const trimmed = raw.trim();
    if (trimmed !== text) {
      try {
        return JSON.parse(jsonrepair(trimmed));
      } catch {
        // fall through
      }
    }
  }

  throw new SyntaxError("Invalid JSON");
}
