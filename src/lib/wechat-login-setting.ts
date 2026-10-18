import { getAppSetting, setAppSetting } from "@/lib/app-settings";

/** app_settings key: hamster (app2) Android WeChat login visibility. */
export const HAMSTER_WECHAT_LOGIN_SETTING_KEY = "hamster_wechat_login_enabled";

/** Default ON when the row is missing (matches product request). */
export const HAMSTER_WECHAT_LOGIN_DEFAULT_ENABLED = true;

export type WechatLoginSetting = {
  enabled: boolean;
  updatedAt: string | null;
  source: "db" | "default";
};

function parseEnabled(raw: string | null | undefined): boolean {
  if (raw == null) return HAMSTER_WECHAT_LOGIN_DEFAULT_ENABLED;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return HAMSTER_WECHAT_LOGIN_DEFAULT_ENABLED;
}

export async function getHamsterWechatLoginSetting(): Promise<WechatLoginSetting> {
  const row = await getAppSetting(HAMSTER_WECHAT_LOGIN_SETTING_KEY);
  if (!row) {
    return {
      enabled: HAMSTER_WECHAT_LOGIN_DEFAULT_ENABLED,
      updatedAt: null,
      source: "default",
    };
  }
  return {
    enabled: parseEnabled(row.value),
    updatedAt: row.updatedAt,
    source: "db",
  };
}

export async function isHamsterWechatLoginEnabled(): Promise<boolean> {
  const setting = await getHamsterWechatLoginSetting();
  return setting.enabled;
}

export async function setHamsterWechatLoginEnabled(
  enabled: boolean,
): Promise<WechatLoginSetting> {
  await setAppSetting(HAMSTER_WECHAT_LOGIN_SETTING_KEY, enabled ? "1" : "0");
  return {
    enabled,
    updatedAt: new Date().toISOString(),
    source: "db",
  };
}
