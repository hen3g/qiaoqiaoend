import { z } from "zod";
import {
  getAichiVipPromoSettings,
  listRecentAichiVipGrants,
  setAichiVipPromoEnabled,
  AICHI_VIP_DAYS,
  AICHI_VIP_MIN_EXTRA_CHARS,
  AICHI_VIP_PREFIX,
} from "@/lib/aichi-vip-promo";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  action: z.literal("setEnabled"),
  enabled: z.boolean(),
});

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
    const [settings, grants] = await Promise.all([
      getAichiVipPromoSettings(),
      listRecentAichiVipGrants(50),
    ]);
    return jsonOk({
      settings,
      grants,
      rule: {
        field: "nickname",
        prefix: AICHI_VIP_PREFIX,
        minExtraChars: AICHI_VIP_MIN_EXTRA_CHARS,
        days: AICHI_VIP_DAYS,
        years: 99,
        skipIfAlreadyVip: true,
        oncePerUser: true,
        triggers: ["register", "rename"],
      },
    });
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
    const body = postSchema.parse(await req.json());
    const settings = await setAichiVipPromoEnabled(body.enabled);
    return jsonOk({
      settings,
      message: settings.enabled ? "已开启爱吃昵称 VIP 活动" : "已关闭爱吃昵称 VIP 活动",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("操作失败", 500);
  }
}
