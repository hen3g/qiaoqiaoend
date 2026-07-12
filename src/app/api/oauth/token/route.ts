import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/oauth-cors";
import {
  createAccessToken,
  findClient,
  isAllowedRedirectUri,
  verifyAuthorizationCode,
  verifyPkceS256,
} from "@/lib/oauth";

const bodySchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
});

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return withCors(req, jsonError("无效的请求体", 400));
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, jsonError("参数无效", 400));
  }

  const { code, redirect_uri, client_id, code_verifier } = parsed.data;
  const client = findClient(client_id);
  if (!client || !isAllowedRedirectUri(client, redirect_uri)) {
    return withCors(req, jsonError("客户端无效", 400));
  }

  const authCode = await verifyAuthorizationCode(code);
  if (!authCode) {
    return withCors(req, jsonError("授权码无效或已过期", 400));
  }

  if (
    authCode.clientId !== client_id ||
    authCode.redirectUri !== redirect_uri
  ) {
    return withCors(req, jsonError("授权码与请求不匹配", 400));
  }

  if (!verifyPkceS256(code_verifier, authCode.codeChallenge)) {
    return withCors(req, jsonError("PKCE 校验失败", 400));
  }

  const accessToken = await createAccessToken({
    userId: authCode.uid,
    clientId: client_id,
  });

  return withCors(
    req,
    jsonOk({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 14 * 24 * 60 * 60,
    }),
  );
}
