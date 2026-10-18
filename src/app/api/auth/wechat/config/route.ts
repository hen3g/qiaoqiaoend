import { jsonError, jsonOk } from "@/lib/api";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { getHamsterWechatLoginSetting } from "@/lib/wechat-login-setting";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return authPreflight();
}

/** Public (no auth): hamster Android WeChat login visibility for the app. */
export async function GET() {
  try {
    const setting = await getHamsterWechatLoginSetting();
    return withAuthCors(
      jsonOk({
        wechatLoginEnabled: setting.enabled,
        updatedAt: setting.updatedAt,
      }),
    );
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("加载失败", 500));
  }
}
