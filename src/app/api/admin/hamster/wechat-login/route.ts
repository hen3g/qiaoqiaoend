import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  getHamsterWechatLoginSetting,
  setHamsterWechatLoginEnabled,
} from "@/lib/wechat-login-setting";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
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
    const setting = await getHamsterWechatLoginSetting();
    return jsonOk({ setting });
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
    const body = updateSchema.parse(await req.json());
    const setting = await setHamsterWechatLoginEnabled(body.enabled);
    return jsonOk({
      setting,
      message: setting.enabled
        ? "已开启微信登录显示"
        : "已关闭微信登录显示",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("保存失败", 500);
  }
}
