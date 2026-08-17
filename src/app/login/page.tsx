import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/oauth";

export const metadata = {
  title: "登录",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const next = sanitizeNextPath(first(searchParams.next)) || "/account";
  const user = await getCurrentUser();
  if (user) {
    redirect(next);
  }

  return (
    <AuthShell
      asideTitle="欢迎回来"
      asideText="登录后可管理账号、查看会员状态与宣传投稿。"
    >
      <AuthForm
        title="登录"
        subtitle="使用用户名或已绑定邮箱，配合密码登录。"
        endpoint="/api/auth/login"
        submitLabel="登录"
        successRedirect={next}
        fields={[
          {
            name: "username",
            label: "用户名或邮箱",
            placeholder: "请输入用户名或邮箱",
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
            <Link
              href={
                next !== "/account"
                  ? `/forgot-password?next=${encodeURIComponent(next)}`
                  : "/forgot-password"
              }
            >
              忘记密码？
            </Link>
          </p>
        }
      />
    </AuthShell>
  );
}
