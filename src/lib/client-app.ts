export const CLIENT_APP_IDS = ["qiaoqiao", "hamster"] as const;
export type ClientAppId = (typeof CLIENT_APP_IDS)[number];

/** Missing / unknown header → 敲敲英语 (the original app). */
export const DEFAULT_CLIENT_APP: ClientAppId = "qiaoqiao";

export const CLIENT_APP_HEADER = "x-client-app";

export type ClientAppFilter = ClientAppId | "all";

export const CLIENT_APP_LABELS: Record<ClientAppId, string> = {
  qiaoqiao: "敲敲英语",
  hamster: "仓鼠单词",
};

export const CLIENT_APP_FILTER_LABELS: Record<ClientAppFilter, string> = {
  all: "全部应用",
  qiaoqiao: "敲敲英语",
  hamster: "仓鼠单词",
};

export function isClientAppId(value: unknown): value is ClientAppId {
  return value === "qiaoqiao" || value === "hamster";
}

export function parseClientAppId(value: string | null | undefined): ClientAppId {
  const normalized = value?.trim().toLowerCase();
  return normalized === "hamster" ? "hamster" : DEFAULT_CLIENT_APP;
}

export function clientAppFromRequest(req: Request): ClientAppId {
  return parseClientAppId(req.headers.get(CLIENT_APP_HEADER));
}

export function parseClientAppFilter(
  value: string | null | undefined,
): ClientAppFilter {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "all") return "all";
  return parseClientAppId(normalized);
}

export function clientAppLabel(appId: string | null | undefined): string {
  if (appId === "all") return CLIENT_APP_FILTER_LABELS.all;
  if (isClientAppId(appId)) return CLIENT_APP_LABELS[appId];
  return CLIENT_APP_LABELS[DEFAULT_CLIENT_APP];
}

export function clientAppTagColor(appId: string | null | undefined): string {
  if (appId === "hamster") return "orangered";
  if (appId === "all") return "gray";
  return "arcoblue";
}
