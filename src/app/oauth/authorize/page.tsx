import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  createAuthorizationCode,
  findClient,
  isAllowedRedirectUri,
} from "@/lib/oauth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function errorRedirect(redirectUri: string, error: string, state: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

function buildAuthorizeQuery(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  confirm?: boolean;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  if (input.scope) params.set("scope", input.scope);
  if (input.confirm) params.set("confirm", "1");
  return params.toString();
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const clientId = first(params.client_id);
  const redirectUri = first(params.redirect_uri);
  const responseType = first(params.response_type);
  const state = first(params.state);
  const codeChallenge = first(params.code_challenge);
  const codeChallengeMethod = first(params.code_challenge_method);
  const scope = first(params.scope);
  const confirm = first(params.confirm) === "1";

  const client = findClient(clientId);
  if (!client || !redirectUri || !isAllowedRedirectUri(client, redirectUri)) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-5 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
          授权请求无效
        </h1>
        <p className="mt-3 text-muted">
          client_id 或 redirect_uri 不正确，请检查客户端配置。
        </p>
      </main>
    );
  }

  if (responseType !== "code") {
    errorRedirect(redirectUri, "unsupported_response_type", state);
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    errorRedirect(redirectUri, "invalid_request", state);
  }

  const authorizeQuery = buildAuthorizeQuery({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    scope,
  });
  const returnTo = `/oauth/authorize?${authorizeQuery}`;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  // Already logged in on word19: show which account will authorize.
  // Do not clear the session here — that would break SSO.
  if (!confirm) {
    const displayName = user.nickname || user.username;
    const confirmHref = `/oauth/authorize?${buildAuthorizeQuery({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scope,
      confirm: true,
    })}`;
    const switchHref = `/api/auth/logout?next=${encodeURIComponent(
      `/login?next=${encodeURIComponent(returnTo)}`,
    )}`;

    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-5 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
          确认授权登录
        </h1>
        <p className="mt-3 text-muted">
          将使用以下账号授权给「宝贝英语客户端」：
        </p>
        <p className="mt-6 text-xl font-medium text-ink">{displayName}</p>
        <p className="mt-1 text-sm text-muted">@{user.username}</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={confirmHref}
            className="inline-flex min-w-[8rem] items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-deep"
          >
            确认授权
          </Link>
          <Link
            href={switchHref}
            className="inline-flex min-w-[8rem] items-center justify-center rounded-lg border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5"
          >
            切换账号
          </Link>
        </div>
      </main>
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
  redirect(target.toString());
}
