import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { sanitizeNextPath } from "@/lib/oauth";

export const metadata = { title: "注册" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const next = sanitizeNextPath(first(searchParams.next)) || "/account";
  const loginHref =
    next !== "/account"
      ? `/login?next=${encodeURIComponent(next)}`
      : "/login";

  return (
    <AuthShell
      asideTitle="创建你的账号"
      asideText="注册后即可开始用键盘敲句子学英语，并管理你的账号。"
    >
      <AuthForm
        title="注册"
        subtitle="只需用户名和密码，几步就能开始。"
        endpoint="/api/auth/register"
        submitLabel="创建账号"
        successRedirect={next}
        fields={[
          {
            name: "username",
            label: "用户名",
            placeholder: "字母、数字、下划线",
            autoComplete: "username",
          },
          {
            name: "password",
            label: "密码",
            type: "password",
            placeholder: "至少 6 位",
            autoComplete: "new-password",
          },
          {
            name: "passwordConfirm",
            label: "确认密码",
            type: "password",
            placeholder: "再输入一次密码",
            autoComplete: "new-password",
          },
        ]}
        footer={
          <p>
            已有账号？{" "}
            <Link
              href={loginHref}
              className="font-medium text-accent-deep hover:underline"
            >
              去登录
            </Link>
          </p>
        }
      />
    </AuthShell>
  );
}
