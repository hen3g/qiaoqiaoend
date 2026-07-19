import { AuthShell } from "@/components/AuthShell";
import type { SessionUser } from "@/lib/auth";
import { describeScope } from "@/lib/oauth";

type Props = {
  clientDisplayName: string;
  user: SessionUser;
  scope: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

export function OAuthConsentForm({
  clientDisplayName,
  user,
  scope,
  clientId,
  redirectUri,
  responseType,
  state,
  codeChallenge,
  codeChallengeMethod,
}: Props) {
  const permissions = describeScope(scope);
  const accountLabel = user.nickname || user.username;

  return (
    <AuthShell
      asideTitle="授权确认"
      asideText="请确认是否允许该应用使用你的官网账号信息。"
    >
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink lg:text-[2rem]">
          授权登录
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          <span className="font-medium text-ink">{clientDisplayName}</span>{" "}
          请求访问你的账号
          <span className="font-medium text-ink"> {accountLabel}</span>。
        </p>

        <div className="mt-8 rounded-2xl border border-line/10 bg-[#f7fbfe] px-5 py-4">
          <p className="text-sm font-medium text-ink/80">将允许应用：</p>
          <ul className="mt-3 space-y-2 text-[15px] text-ink">
            {permissions.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <form action="/api/oauth/authorize" method="post" className="mt-8 space-y-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="response_type" value={responseType} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input
            type="hidden"
            name="code_challenge_method"
            value={codeChallengeMethod}
          />
          {scope ? <input type="hidden" name="scope" value={scope} /> : null}

          <button
            type="submit"
            name="decision"
            value="allow"
            className="w-full cursor-pointer rounded-full bg-accent px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-[var(--glow)] transition hover:bg-accent-deep"
          >
            允许
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="w-full rounded-full border border-line/10 bg-white px-6 py-3.5 text-base font-medium text-ink transition hover:bg-[#f7fbfe]"
          >
            拒绝
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
