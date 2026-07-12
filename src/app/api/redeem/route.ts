import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { requireCapToken } from "@/lib/cap";
import { redeemCode } from "@/lib/redeem";

const schema = z.object({
  code: z.string().min(1, "请输入兑换码"),
  captchaToken: z.string().min(1, "请先完成人机验证"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError("请先登录后再兑换", 401);
    }

    const body = schema.parse(await req.json());
    try {
      await requireCapToken(body.captchaToken);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "人机验证失败");
    }

    const result = await redeemCode(user.id, body.code);
    const refreshed = await getCurrentUser();

    return jsonOk({
      message: result.message,
      type: result.type,
      user: refreshed,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    if (err instanceof Error) {
      return jsonError(err.message);
    }
    console.error(err);
    return jsonError("兑换失败，请稍后重试", 500);
  }
}
