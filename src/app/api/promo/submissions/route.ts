import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { IP_RATE_HOUR_MS, ipRateLimited } from "@/lib/ip-rate-limit";
import {
  createPromoSubmission,
  listPromoSubmissionsForUser,
} from "@/lib/promo";

const createSchema = z.object({
  videoUrl: z
    .string()
    .trim()
    .url("请填写有效的短视频链接")
    .max(500, "链接过长"),
  likesClaimed: z
    .union([z.number().int().min(0).max(10000000), z.null()])
    .optional()
    .transform((v) => (v == null ? null : v)),
  note: z
    .union([z.string().trim().max(255), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

function mapAuthError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return jsonError("请先登录", 401);
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const submissions = await listPromoSubmissionsForUser(user.id);
    return jsonOk({ submissions });
  } catch (err) {
    const mapped = mapAuthError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const limited = await ipRateLimited(req, "promo-submit", {
      max: 5,
      windowMs: IP_RATE_HOUR_MS,
    });
    if (limited) return limited;
    const body = createSchema.parse(await req.json());
    const submission = await createPromoSubmission({
      userId: user.id,
      videoUrl: body.videoUrl,
      likesClaimed: body.likesClaimed ?? null,
      note: body.note ?? null,
    });
    return jsonOk({ submission, message: "已提交，等待审核" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapAuthError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("提交失败", 500);
  }
}
