import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/oauth";

export const metadata = { title: "登录" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(first(params.next)) || "/account";
  const user = await getCurrentUser();
  if (user) {
    redirect(next);
  }

  const registerHref =
    next !== "/account"
      ? `/register?next=${encodeURIComponent(next)}`
      : "/register";

  return (
    <AuthShell
      asideTitle="欢迎回来"
      asideText="登录后可兑换会员、下载课程，并管理你的账号。"
    >
      <AuthForm
        title="登录"
        subtitle="使用用户名和密码登录官网账号。"
        endpoint="/api/auth/login"
        submitLabel="登录"
        successRedirect={next}
        fields={[
          {
            name: "username",
            label: "用户名",
            placeholder: "请输入用户名",
            autoComplete: "username",
          },
          {
            name: "password",
            label: "密码",
            type: "password",
            placeholder: "请输入密码",
            autoComplete: "current-password",
          },
        ]}
        footer={
          <p>
            还没有账号？{" "}
            <Link
              href={registerHref}
              className="font-medium text-accent-deep hover:underline"
            >
              立即注册
            </Link>
          </p>
        }
      />
    </AuthShell>
  );
}
