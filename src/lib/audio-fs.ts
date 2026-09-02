export type AudioSource = "builtin" | "user" | "series";

export function textToAudioFilename(
  text: string,
  speaker?: string | null,
): string {
  let s = text.trim();
  s = s.replace(/^[A-Za-z]:\s*/, "");
  s = s.replace(/ /g, "_");
  while (s.endsWith(".") || s.endsWith("?")) {
    s = s.slice(0, -1);
  }
  const safeSpeaker = speaker?.trim().replace(/[/\\:\0<>"|*?]/g, "");
  if (safeSpeaker) {
    s = `${safeSpeaker}_${s}`;
  }
  return `${s}.mp3`;
}

export function isSafeAudioFilename(filename: string): boolean {
  return Boolean(
    filename &&
      filename !== ".mp3" &&
      !filename.includes("/") &&
      !filename.includes("\\") &&
      !filename.includes("\0"),
  );
}

/** App2 (仓鼠单词) CDN filenames — lowercase to match the client. */
export function textToApp2AudioFilename(
  text: string,
  speaker?: string | null,
): string {
  let s = text.trim().toLowerCase();
  s = s.replace(/^[a-z]:\s*/, "");
  s = s.replace(/ /g, "_");
  while (s.endsWith(".") || s.endsWith("?")) {
    s = s.slice(0, -1);
  }
  const safeSpeaker = speaker
    ?.trim()
    .toLowerCase()
    .replace(/[/\\:\0<>"|*?]/g, "");
  if (safeSpeaker) {
    s = `${safeSpeaker}_${s}`;
  }
  return `${s}.mp3`;
}
