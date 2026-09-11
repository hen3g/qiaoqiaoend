export const HAMSTER_LANGS = ["zh", "ja"] as const;
export type HamsterLang = (typeof HAMSTER_LANGS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Resolve ?lang= for hamster legal/guide pages. Default zh (Chinese unchanged). */
export function resolveHamsterLang(
  searchParams?: SearchParams,
): HamsterLang {
  const raw = first(searchParams?.lang).trim().toLowerCase().replace("_", "-");
  if (raw.startsWith("ja")) return "ja";
  return "zh";
}

/** Preserve lang on internal hamster links (omit query for default zh). */
export function hamsterHref(path: string, lang: HamsterLang): string {
  if (lang === "zh") return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}lang=${lang}`;
}

export const HTML_LANG: Record<HamsterLang, string> = {
  zh: "zh-CN",
  ja: "ja",
};

export const COMPANY = {
  zh: "言词科技（大连）有限公司",
  ja: "言词科技（大连）有限公司",
} as const;

export const PRODUCT = {
  zh: "仓鼠单词",
  ja: "倉鼠単語",
} as const;

export const CONTACT_EMAIL = "baseheng@qq.com";
export const CONTACT_WECHAT = "535938559";
export const SITE_URL = "https://yancilanguage.cn/";
export const SITE_HOST = "yancilanguage.cn";
