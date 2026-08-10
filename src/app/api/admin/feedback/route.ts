import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import { listFeedbackSubmissions } from "@/lib/feedback";

function mapAdminError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return jsonError("请先登录", 401);
  }
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const submissions = await listFeedbackSubmissions();
    return jsonOk({ submissions, total: submissions.length });
  } catch (err) {
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
