import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  listAllUserCourses,
  listAllUserPapers,
} from "@/lib/user-content-admin";

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const [courses, papers] = await Promise.all([
      listAllUserCourses(),
      listAllUserPapers(),
    ]);
    return jsonOk({
      courses,
      papers,
      totals: {
        courses: courses.length,
        papers: papers.length,
        users: new Set([
          ...courses.map((c) => c.userId),
          ...papers.map((p) => p.userId),
        ]).size,
      },
    });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
