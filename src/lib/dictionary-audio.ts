import {
  isSafeAudioFilename,
  textToApp2AudioFilename,
} from "@/lib/audio-fs";
import {
  collectDictionarySpeakableTexts,
  type DictionaryWordEntry,
} from "@/lib/dictionary-word";
import {
  audioObjectKey,
  r2Head,
  r2Put,
  r2PublicUrl,
} from "@/lib/r2";
import { TtsClient } from "@/lib/tts-client";

const DEFAULT_VOICE = "en-US-JennyNeural";
const FALLBACK_AUDIO_BASE = "https://base.companiesrelated.com/audio";

function publicAudioUrl(filename: string): string {
  try {
    return r2PublicUrl(audioObjectKey(filename));
  } catch {
    return `${FALLBACK_AUDIO_BASE}/${filename}`;
  }
}

export type DictionaryAudioFile = {
  text: string;
  filename: string;
  url: string;
  status: "generated" | "skipped" | "failed";
  error?: string;
};

export type DictionaryAudioResult = {
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  errors: { text: string; error: string }[];
  files: DictionaryAudioFile[];
};

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!, i);
    }
  }
  const n = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export function dictionaryAudioFilename(text: string): string {
  return textToApp2AudioFilename(text);
}

export async function ensureDictionaryAudio(
  entry: DictionaryWordEntry,
  opts: { concurrency?: number; force?: boolean } = {},
): Promise<DictionaryAudioResult> {
  const concurrency = opts.concurrency ?? 3;
  const force = opts.force ?? false;
  const speakable = collectDictionarySpeakableTexts(entry);

  const planned = speakable
    .map((text) => {
      const filename = dictionaryAudioFilename(text);
      return { text, filename };
    })
    .filter((item) => isSafeAudioFilename(item.filename));

  const files: DictionaryAudioFile[] = planned.map((item) => ({
    text: item.text,
    filename: item.filename,
    url: publicAudioUrl(item.filename),
    status: "skipped",
  }));

  const existsFlags = await Promise.all(
    planned.map(async (item) => {
      if (force) return false;
      return r2Head(audioObjectKey(item.filename));
    }),
  );

  const pending: { index: number; text: string; filename: string }[] = [];
  let skipped = 0;
  planned.forEach((item, i) => {
    if (existsFlags[i]) {
      skipped += 1;
      files[i]!.status = "skipped";
    } else {
      pending.push({ index: i, ...item });
    }
  });

  let generated = 0;
  let failed = 0;
  const errors: { text: string; error: string }[] = [];
  const ttsClient = new TtsClient({ voice: DEFAULT_VOICE });

  await mapPool(pending, concurrency, async (item) => {
    try {
      if (!force && (await r2Head(audioObjectKey(item.filename)))) {
        skipped += 1;
        files[item.index]!.status = "skipped";
        return;
      }
      const buf = await ttsClient.synthesiseWithRetry(item.text, {
        voice: DEFAULT_VOICE,
      });
      await r2Put(audioObjectKey(item.filename), buf, "audio/mpeg");
      generated += 1;
      files[item.index]!.status = "generated";
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ text: item.text, error: message });
      files[item.index]!.status = "failed";
      files[item.index]!.error = message;
    }
  });

  return {
    total: planned.length,
    generated,
    skipped,
    failed,
    errors,
    files,
  };
}
