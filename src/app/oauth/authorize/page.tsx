import { redirect } from "next/navigation";
import { OAuthConsentForm } from "@/components/OAuthConsentForm";
import { getCurrentUser } from "@/lib/auth";
import { findClient, isAllowedRedirectUri } from "@/lib/oauth";

type SearchParams = Record<string, string | string[] | undefined>;

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

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const clientId = first(searchParams.client_id);
  const redirectUri = first(searchParams.redirect_uri);
  const responseType = first(searchParams.response_type);
  const state = first(searchParams.state);
  const codeChallenge = first(searchParams.code_challenge);
  const codeChallengeMethod = first(searchParams.code_challenge_method);
  const scope = first(searchParams.scope);

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
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  return (
    <OAuthConsentForm
      clientDisplayName={client.displayName}
      user={user}
      scope={scope}
      clientId={clientId}
      redirectUri={redirectUri}
      responseType={responseType}
      state={state}
      codeChallenge={codeChallenge}
      codeChallengeMethod={codeChallengeMethod}
    />
  );
}
