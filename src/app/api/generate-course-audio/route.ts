import type { CoursePack } from "@/data/course-types";
import { jsonError, jsonOk } from "@/lib/api";
import { createAudioProgressSse } from "@/lib/audio-sse";
import { getCurrentUser } from "@/lib/auth";
import { authCorsHeaders, authPreflight, withAuthCors } from "@/lib/auth-cors";
import { generateCourseAudio } from "@/lib/course-audio";
import { markUserCourseAudioReady } from "@/lib/user-courses-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  course?: CoursePack;
  /** Prefer true for progress UI. Mobile uses XHR SSE. */
  stream?: boolean;
  /** When true (default), mark course audioReady after SSE/JSON completes. */
  markReady?: boolean;
};

function isCoursePack(value: unknown): value is CoursePack {
  if (!value || typeof value !== "object") return false;
  const c = value as CoursePack;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    Array.isArray(c.lessons)
  );
}

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return withAuthCors(jsonError("无效的 JSON"));
    }

    if (!isCoursePack(body.course)) {
      return withAuthCors(jsonError("缺少有效的 course"));
    }

    const course = body.course;
    const useStream = body.stream !== false;
    const markReady = body.markReady !== false;

    if (!useStream) {
      const done = await generateCourseAudio(course, { concurrency: 3 });
      let updated: CoursePack | null = null;
      if (markReady) {
        updated = await markUserCourseAudioReady(user.id, course.id);
      }
      return withAuthCors(
        jsonOk({
          total: done.total,
          generated: done.generated,
          skipped: done.skipped,
          failed: done.failed,
          errors: done.errors,
          course: updated ?? { ...course, audioReady: markReady },
        }),
      );
    }

    const sse = createAudioProgressSse({
      run: async (send, signal) => {
        await send({
          type: "start",
          total: 0,
          pending: 0,
          skipped: 0,
        });

        let finalDone: {
          type: "done";
          total: number;
          generated: number;
          skipped: number;
          failed: number;
          errors: { text: string; error: string }[];
        } | null = null;

        await generateCourseAudio(course, {
          concurrency: 3,
          signal,
          onProgress: async (event) => {
            // Delay "done" until audioReady is persisted, so clients don't race.
            if (event.type === "done") {
              finalDone = event;
              return;
            }
            await send(event);
          },
        });

        if (markReady && !signal.aborted) {
          await markUserCourseAudioReady(user.id, course.id).catch(() => null);
        }
        if (finalDone) {
          await send(finalDone);
        }
      },
    });

    const headers = new Headers(sse.headers);
    for (const [key, value] of Object.entries(authCorsHeaders())) {
      headers.set(key, value);
    }
    headers.set("X-Accel-Buffering", "no");
    return new NextResponse(sse.body, { status: 200, headers });
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读音生成失败", 500),
    );
  }
}
