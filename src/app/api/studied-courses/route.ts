import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  listStudiedCourses,
  upsertStudiedCourse,
} from "@/lib/studied-courses-db";

export async function OPTIONS() {
  return authPreflight();
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const prefix = url.searchParams.get("prefix") ?? undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const courses = await listStudiedCourses(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      prefix,
    });

    return withAuthCors(jsonOk({ courses }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读取学习记录失败", 500),
    );
  }
}

/**
 * 记录一次打开/学习。
 * Body: { packId: string, packTitle: string }
 * 返回更新后的最近列表（默认 oxford 前缀、limit 12）。
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    let body: { packId?: string; packTitle?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    const packId = typeof body.packId === "string" ? body.packId.trim() : "";
    const packTitle =
      typeof body.packTitle === "string" ? body.packTitle.trim() : "";
    if (!packId) {
      return withAuthCors(jsonError("请提供 packId"));
    }
    if (!packTitle) {
      return withAuthCors(jsonError("请提供 packTitle"));
    }

    await upsertStudiedCourse(user.id, packId, packTitle);

    const prefix = packId.startsWith("oxford-course-")
      ? "oxford-course-"
      : undefined;
    const courses = await listStudiedCourses(user.id, {
      limit: 12,
      prefix,
    });

    return withAuthCors(jsonOk({ courses }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "保存学习记录失败", 500),
    );
  }
}
