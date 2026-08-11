import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { batchDeleteUserCoursesForUser } from "@/lib/user-courses-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const body = (await req.json().catch(() => null)) as {
      ids?: unknown;
    } | null;
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = rawIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return withAuthCors(jsonError("请选择要删除的课程"));
    }
    if (ids.length > 100) {
      return withAuthCors(jsonError("一次最多删除 100 门课程"));
    }

    const result = await batchDeleteUserCoursesForUser(user.id, ids);
    return withAuthCors(
      jsonOk({
        deleted: result.deleted,
        failed: result.failed,
        deletedCount: result.deleted.length,
      }),
    );
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("批量删除失败", 500));
  }
}
