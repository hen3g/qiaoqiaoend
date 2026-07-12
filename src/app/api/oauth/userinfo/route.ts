import { jsonError, jsonOk } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/oauth-cors";
import { getUserByIdIfTokenVersion, readAccessToken } from "@/lib/oauth";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const header = req.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return withCors(req, jsonError("未授权", 401));
  }

  const access = await readAccessToken(match[1]!.trim());
  if (!access) {
    return withCors(req, jsonError("令牌无效或已过期", 401));
  }

  const user = await getUserByIdIfTokenVersion(
    access.userId,
    access.tokenVersion,
  );
  if (!user) {
    return withCors(req, jsonError("令牌已失效，请重新登录", 401));
  }

  return withCors(req, jsonOk({ user }));
}
