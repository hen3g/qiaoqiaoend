import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  listMyCourseSummaries,
  type MyCoursesSort,
} from "@/lib/user-courses-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS = new Set<MyCoursesSort>([
  "updated_desc",
  "updated_asc",
  "title_asc",
  "title_desc",
]);

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
    const sortParam = (url.searchParams.get("sort")?.trim() ||
      "updated_desc") as MyCoursesSort;
    const sort = SORTS.has(sortParam) ? sortParam : "updated_desc";

    const groupParam = url.searchParams.get("groupId")?.trim();
    let groupId: number | "ungrouped" | undefined;
    if (groupParam === "ungrouped" || groupParam === "0") {
      groupId = "ungrouped";
    } else if (groupParam) {
      const n = Number(groupParam);
      if (Number.isInteger(n) && n > 0) groupId = n;
    }

    const result = await listMyCourseSummaries({
      userId: user.id,
      page,
      q,
      groupId,
      sort,
    });

    return withAuthCors(jsonOk(result));
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载我的课程失败", 500));
  }
}
