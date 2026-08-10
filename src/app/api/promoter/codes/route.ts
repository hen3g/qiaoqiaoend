import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  createPromoterCode,
  listPromoterCodes,
  PROMOTER_ALLOWED_DAYS,
  requirePromoterUser,
} from "@/lib/promoter";

const createSchema = z.object({
  code: z.string().min(1, "请输入兑换码"),
  days: z.coerce
    .number()
    .refine(
      (d): d is (typeof PROMOTER_ALLOWED_DAYS)[number] =>
        (PROMOTER_ALLOWED_DAYS as readonly number[]).includes(d),
      "会员天数只能选择 7 天或 30 天",
    ),
});

function mapError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("仅推广者可使用", 403);
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    await requirePromoterUser(user.id);
    const codes = await listPromoterCodes(user.id);
    return jsonOk({ codes });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await requirePromoterUser(user.id);
    const body = createSchema.parse(await req.json());
    const code = await createPromoterCode(user.id, body);
    return jsonOk({ code, message: "推广兑换码已创建" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("创建失败", 500);
  }
}
