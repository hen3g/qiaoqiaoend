import type { AudioProgressEvent } from "@/lib/course-audio";
import { createJsonSse } from "@/lib/sse";

/**
 * SSE response for course/paper audio progress.
 */
export function createAudioProgressSse(options: {
  run: (
    send: (event: AudioProgressEvent) => Promise<void>,
    signal: AbortSignal,
  ) => Promise<void>;
}): Response {
  return createJsonSse<AudioProgressEvent>({
    run: options.run,
    onErrorEvent: (message) => ({
      type: "done",
      total: 0,
      generated: 0,
      skipped: 0,
      failed: 1,
      errors: [{ text: "", error: message || "读音加载失败" }],
    }),
  });
}
