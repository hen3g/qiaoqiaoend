import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  listQuestionReports,
  setQuestionReportStatus,
  type QuestionReportStatus,
} from "@/lib/question-reports";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  action: z.enum(["handle", "reopen"]),
  id: z.number().int().positive(),
});

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
    const reports = await listQuestionReports();
    return jsonOk({ reports, total: reports.length });
  } catch (err) {
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = updateSchema.parse(await req.json());
    const status: QuestionReportStatus =
      body.action === "handle" ? "handled" : "pending";
    const report = await setQuestionReportStatus({
      id: body.id,
      status,
    });
    return jsonOk({
      report,
      message: status === "handled" ? "已标记处理" : "已重新打开",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("操作失败", 500);
  }
}
