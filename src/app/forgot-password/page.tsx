import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/oauth";

export const metadata = { title: "忘记密码" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const next = sanitizeNextPath(first(searchParams.next)) || "/account";
  const user = await getCurrentUser();
  if (user) {
    redirect(next);
  }

  const loginHref =
    next !== "/account"
      ? `/login?next=${encodeURIComponent(next)}`
      : "/login";

  return (
    <AuthShell
      asideTitle="找回密码"
      asideText="仅支持已绑定邮箱的账号。验证邮箱后即可设置新密码。"
    >
      <ForgotPasswordForm loginHref={loginHref} />
    </AuthShell>
  );
}
