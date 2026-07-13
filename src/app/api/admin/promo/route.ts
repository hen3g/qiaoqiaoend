import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  listAllPromoSubmissions,
  rejectPromoSubmission,
  rewardPromoSubmission,
} from "@/lib/promo";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reward"),
    id: z.number().int().positive(),
    months: z.number().int().min(1).max(120),
    adminNote: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  }),
  z.object({
    action: z.literal("reject"),
    id: z.number().int().positive(),
    adminNote: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  }),
]);

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
    const submissions = await listAllPromoSubmissions();
    return jsonOk({ submissions, total: submissions.length });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = actionSchema.parse(await req.json());
    if (body.action === "reward") {
      const submission = await rewardPromoSubmission({
        id: body.id,
        months: body.months,
        adminNote: body.adminNote ?? null,
      });
      return jsonOk({
        submission,
        message: `已发放 ${body.months} 个月会员`,
      });
    }
    const submission = await rejectPromoSubmission({
      id: body.id,
      adminNote: body.adminNote ?? null,
    });
    return jsonOk({ submission, message: "已驳回该投稿" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("操作失败", 500);
  }
}
