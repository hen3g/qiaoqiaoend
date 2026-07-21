import { jsonError, jsonOk } from "@/lib/api";
import { listCheckinParticipants } from "@/lib/checkin";
import { requireAdmin } from "@/lib/dev-admin";

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
    const participants = await listCheckinParticipants();
    return jsonOk({
      participants,
      total: participants.length,
    });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
