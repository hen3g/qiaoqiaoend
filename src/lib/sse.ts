const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * Generic SSE response. Do NOT attach Next.js request.signal —
 * it often aborts as soon as the handler returns the Response.
 */
export function createJsonSse<T>(options: {
  run: (
    send: (event: T) => Promise<void>,
    signal: AbortSignal,
  ) => Promise<void>;
  onErrorEvent?: (message: string) => T;
}): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let queue: Promise<void> = Promise.resolve();

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (event: T): Promise<void> => {
        queue = queue.then(() => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          } catch {
            closed = true;
            abort.abort();
          }
        });
        return queue;
      };

      try {
        await options.run(send, abort.signal);
      } catch (err) {
        if (!closed && options.onErrorEvent) {
          const aborted =
            abort.signal.aborted ||
            (err instanceof Error && err.name === "AbortError");
          const message = aborted
            ? "已取消"
            : err instanceof Error
              ? err.message
              : "请求失败";
          await send(options.onErrorEvent(message));
        }
      } finally {
        await queue.catch(() => undefined);
        close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
