import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { listPlazaCourseSummaries } from "@/lib/user-courses-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const rawPage = Number(url.searchParams.get("page") || 1);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const q = url.searchParams.get("q")?.trim() || undefined;
    const rawAuthorId = Number(url.searchParams.get("authorId") || 0);
    const authorId =
      Number.isInteger(rawAuthorId) && rawAuthorId > 0
        ? rawAuthorId
        : undefined;
    const result = await listPlazaCourseSummaries({
      viewerId: user.id,
      page,
      q,
      authorId,
    });

    return withAuthCors(jsonOk(result));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载课程广场失败", 500));
  }
}
