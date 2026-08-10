/** 解析 / 规范化对话行里的说话人标记 */

const SPEAKER_PREFIX_RE =
  /^([A-Za-z][A-Za-z0-9 _\-']{0,24}|[\u4e00-\u9fff]{1,8})\s*[:：]\s*/u;

export type DialogueLine = {
  speaker: string | null;
  content: string;
};

/** 从正文开头拆出遗留的「A: / B:」前缀 */
export function parseDialogueLine(text: string): DialogueLine {
  const trimmed = text.trimStart();
  const m = trimmed.match(SPEAKER_PREFIX_RE);
  if (!m) return { speaker: null, content: text };
  return {
    speaker: m[1].trim(),
    content: trimmed.slice(m[0].length),
  };
}

/** 去掉说话人前缀后的正文 */
export function dialogueContent(text: string): string {
  return parseDialogueLine(text).content;
}

/**
 * 规范化一道练习：优先用 speaker 字段；
 * 若 en/zh 仍带「A:」前缀（旧数据），拆出并写入 speaker，正文去掉前缀。
 */
export function normalizeSentenceDialogue(input: {
  en: string;
  zh: string;
  speaker?: string;
}): { en: string; zh: string; speaker?: string } {
  const enParsed = parseDialogueLine(input.en);
  const zhParsed = parseDialogueLine(input.zh);
  const speaker =
    input.speaker?.trim() ||
    enParsed.speaker ||
    zhParsed.speaker ||
    undefined;

  return {
    en: enParsed.content,
    zh: zhParsed.speaker ? zhParsed.content : input.zh,
    ...(speaker ? { speaker } : {}),
  };
}
