import { jsonError, jsonOk } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/oauth-cors";
import { getUserById, readAccessTokenUserId } from "@/lib/oauth";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const header = req.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return withCors(req, jsonError("未授权", 401));
  }

  const userId = await readAccessTokenUserId(match[1]!.trim());
  if (!userId) {
    return withCors(req, jsonError("令牌无效或已过期", 401));
  }

  const user = await getUserById(userId);
  if (!user) {
    return withCors(req, jsonError("用户不存在", 401));
  }

  return withCors(req, jsonOk({ user }));
}
