/**
 * Extract speakable texts from a course and ensure mp3s exist on R2.
 * Practice: R2 head check → Microsoft Edge TTS → PutObject.
 */
import type { CoursePack } from "@/data/course-types";
import {
  type AudioSource,
  isSafeAudioFilename,
  textToAudioFilename,
} from "@/lib/audio-fs";
import { dialogueContent } from "@/lib/dialogue-line";
import {
  audioObjectKey,
  r2Head,
  r2Put,
  r2PublicBaseUrl,
  r2PublicUrl,
} from "@/lib/r2";
import { TtsClient } from "@/lib/tts-client";

function getR2PublicBaseUrlSafe(): string {
  try {
    return r2PublicBaseUrl();
  } catch {
    return "https://base.companiesrelated.com";
  }
}

export const COURSE_AUDIO_CDN_BASE = `${getR2PublicBaseUrlSafe()}/audio`;

const DEFAULT_VOICE = "en-US-JennyNeural";
const DEFAULT_DIALOGUE_VOICES = [
  "en-US-JennyNeural",
  "en-US-GuyNeural",
  "en-US-AriaNeural",
  "en-US-DavisNeural",
];

export type AudioTextItem = {
  speakText: string;
  filename: string;
  kind: "word" | "sentence";
  voice: string;
  speaker?: string;
};

export type AudioProgressEvent =
  | {
      type: "start";
      total: number;
      pending: number;
      skipped: number;
    }
  | {
      type: "progress";
      done: number;
      pending: number;
      total: number;
      current: string;
      status: "generated" | "skipped" | "failed";
      error?: string;
    }
  | {
      type: "done";
      total: number;
      generated: number;
      skipped: number;
      failed: number;
      errors: { text: string; error: string }[];
    };

function normalizeText(text: string): string {
  return text.trim().split(/\s+/).join(" ");
}

function collectDialogueSpeakers(course: CoursePack): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const lesson of course.lessons ?? []) {
    for (const entry of lesson?.sentences ?? []) {
      const speaker = entry.speaker?.trim();
      if (!speaker || seen.has(speaker)) continue;
      seen.add(speaker);
      ordered.push(speaker);
    }
  }
  return ordered;
}

function assignSpeakerVoices(
  speakers: string[],
  dialogueVoices: string[] = DEFAULT_DIALOGUE_VOICES,
): Record<string, string> {
  const pool = dialogueVoices.length ? dialogueVoices : DEFAULT_DIALOGUE_VOICES;
  const map: Record<string, string> = {};
  speakers.forEach((speaker, i) => {
    map[speaker] = pool[i % pool.length]!;
  });
  return map;
}

export function voiceForSpeaker(speaker: string): string {
  const trimmed = speaker.trim();
  if (!trimmed) return DEFAULT_VOICE;
  const idx = Math.max(0, trimmed.toUpperCase().charCodeAt(0) - 65);
  return DEFAULT_DIALOGUE_VOICES[idx % DEFAULT_DIALOGUE_VOICES.length]!;
}

export function extractCourseAudioItems(
  course: CoursePack,
  opts: {
    defaultVoice?: string;
    dialogueVoices?: string[];
  } = {},
): AudioTextItem[] {
  const defaultVoice = opts.defaultVoice ?? DEFAULT_VOICE;
  const speakers = collectDialogueSpeakers(course);
  const speakerVoices = speakers.length
    ? assignSpeakerVoices(speakers, opts.dialogueVoices)
    : {};

  const items: AudioTextItem[] = [];
  const seen = new Set<string>();

  for (const lesson of course.lessons ?? []) {
    if (!lesson) continue;
    for (const word of lesson.words ?? []) {
      if (!word?.en) continue;
      const speak = normalizeText(dialogueContent(word.en));
      if (!speak) continue;
      const filename = textToAudioFilename(speak);
      if (!filename || filename === ".mp3" || seen.has(filename)) continue;
      seen.add(filename);
      items.push({
        speakText: speak,
        filename,
        kind: "word",
        voice: defaultVoice,
      });
    }

    for (const sentence of lesson.sentences ?? []) {
      if (!sentence?.en) continue;
      const speak = normalizeText(dialogueContent(sentence.en));
      if (!speak) continue;
      const speaker = sentence.speaker?.trim() || undefined;
      const filename = textToAudioFilename(speak, speaker);
      if (!filename || filename === ".mp3" || seen.has(filename)) continue;
      seen.add(filename);

      let voice = defaultVoice;
      if (speaker && speakerVoices[speaker]) {
        voice = speakerVoices[speaker];
      }

      items.push({
        speakText: speak,
        filename,
        kind: "sentence",
        voice,
        ...(speaker ? { speaker } : {}),
      });
    }
  }

  return items;
}

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

export type GenerateCourseAudioOptions = {
  concurrency?: number;
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: AudioProgressEvent) => void | Promise<void>;
};

export function cdnAudioUrl(filename: string): string {
  return r2PublicUrl(audioObjectKey(filename));
}

async function audioExists(filename: string): Promise<boolean> {
  if (!isSafeAudioFilename(filename)) return false;
  return r2Head(audioObjectKey(filename));
}

async function putAudioToR2(filename: string, buf: Buffer): Promise<void> {
  await r2Put(audioObjectKey(filename), buf, "audio/mpeg");
}

export type DownloadCourseAudioOptions = GenerateCourseAudioOptions & {
  source?: AudioSource;
};

export async function downloadCourseAudio(
  course: CoursePack,
  opts: DownloadCourseAudioOptions = {},
): Promise<Extract<AudioProgressEvent, { type: "done" }>> {
  void opts.source;
  const concurrency = opts.concurrency ?? 3;
  const force = opts.force ?? false;
  const onProgress = opts.onProgress;
  const signal = opts.signal;
  const items = extractCourseAudioItems(course);

  const pending: AudioTextItem[] = [];
  let skipped = 0;

  // Probe existence in parallel — sequential r2Head looks like a hang.
  const existsFlags = await Promise.all(
    items.map(async (item) => {
      if (signal?.aborted) return true;
      if (force) return false;
      return audioExists(item.filename);
    }),
  );

  items.forEach((item, i) => {
    if (existsFlags[i]) {
      skipped += 1;
    } else {
      pending.push(item);
    }
  });

  await onProgress?.({
    type: "start",
    total: items.length,
    pending: pending.length,
    skipped,
  });

  let generated = 0;
  let failed = 0;
  let donePending = 0;
  const errors: { text: string; error: string }[] = [];
  const ttsClient = new TtsClient({ voice: DEFAULT_VOICE });

  await mapPool(pending, concurrency, async (item) => {
    if (signal?.aborted) return;
    try {
      if (!force && (await audioExists(item.filename))) {
        skipped += 1;
        donePending += 1;
        await onProgress?.({
          type: "progress",
          done: donePending,
          pending: pending.length,
          total: items.length,
          current: item.speakText,
          status: "skipped",
        });
        return;
      }

      if (signal?.aborted) return;

      const buf = await ttsClient.synthesiseWithRetry(item.speakText, {
        voice: item.voice,
      });
      if (signal?.aborted) return;
      await putAudioToR2(item.filename, buf);

      generated += 1;
      donePending += 1;
      await onProgress?.({
        type: "progress",
        done: donePending,
        pending: pending.length,
        total: items.length,
        current: item.speakText,
        status: "generated",
      });
    } catch (err) {
      if (signal?.aborted) return;
      failed += 1;
      donePending += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ text: item.speakText, error: message });
      await onProgress?.({
        type: "progress",
        done: donePending,
        pending: pending.length,
        total: items.length,
        current: item.speakText,
        status: "failed",
        error: message,
      });
    }
  });

  const done: Extract<AudioProgressEvent, { type: "done" }> = {
    type: "done",
    total: items.length,
    generated,
    skipped,
    failed,
    errors,
  };
  await onProgress?.(done);
  return done;
}

export async function generateCourseAudio(
  course: CoursePack,
  opts: GenerateCourseAudioOptions = {},
): Promise<Extract<AudioProgressEvent, { type: "done" }>> {
  return downloadCourseAudio(course, opts);
}
