import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createAuthorizationCode,
  findClient,
  isAllowedRedirectUri,
} from "@/lib/oauth";

function first(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** 303 so browsers convert the consent form POST into a GET on redirect. */
function redirectSeeOther(url: string | URL) {
  return NextResponse.redirect(url.toString(), 303);
}

function redirectWithError(
  redirectUri: string,
  error: string,
  state: string,
) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return redirectSeeOther(url);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const clientId = first(form.get("client_id"));
  const redirectUri = first(form.get("redirect_uri"));
  const responseType = first(form.get("response_type"));
  const state = first(form.get("state"));
  const codeChallenge = first(form.get("code_challenge"));
  const codeChallengeMethod = first(form.get("code_challenge_method"));
  const scope = first(form.get("scope"));
  const decision = first(form.get("decision"));

  const client = findClient(clientId);
  if (!client || !redirectUri || !isAllowedRedirectUri(client, redirectUri)) {
    return NextResponse.json(
      { ok: false, error: "client_id 或 redirect_uri 不正确" },
      { status: 400 },
    );
  }

  if (decision === "deny") {
    return redirectWithError(redirectUri, "access_denied", state);
  }

  if (decision !== "allow") {
    return NextResponse.json({ ok: false, error: "无效的授权决定" }, { status: 400 });
  }

  if (responseType !== "code") {
    return redirectWithError(redirectUri, "unsupported_response_type", state);
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return redirectWithError(redirectUri, "invalid_request", state);
  }

  const user = await getCurrentUser();
  if (!user) {
    const returnTo = `/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      ...(scope ? { scope } : {}),
    }).toString()}`;
    return redirectSeeOther(
      new URL(`/login?next=${encodeURIComponent(returnTo)}`, req.url),
    );
  }

  const code = await createAuthorizationCode({
    userId: user.id,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: "S256",
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return redirectSeeOther(target);
}
