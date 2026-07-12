"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import type { SessionUser } from "@/lib/auth";

export default function ChangePasswordPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <AuthShell asideTitle="修改密码" asideText="加载中…">
        <p className="text-muted">加载中…</p>
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell
        asideTitle="修改密码"
        asideText="登录后才能修改密码。"
      >
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            需要登录
          </h2>
          <p className="mt-3 text-muted">
            请先登录后再修改密码。
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-deep"
          >
            去登录
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      asideTitle="修改密码"
      asideText="为了账号安全，请输入当前密码后再设置新密码。"
    >
      <AuthForm
        title="修改密码"
        subtitle={`当前账号：${user.username}`}
        endpoint="/api/auth/change-password"
        submitLabel="保存新密码"
        successRedirect="/account"
        fields={[
          {
            name: "oldPassword",
            label: "当前密码",
            type: "password",
            autoComplete: "current-password",
          },
          {
            name: "newPassword",
            label: "新密码",
            type: "password",
            placeholder: "至少 6 位",
            autoComplete: "new-password",
          },
          {
            name: "newPasswordConfirm",
            label: "确认新密码",
            type: "password",
            placeholder: "再输入一次新密码",
            autoComplete: "new-password",
          },
        ]}
        footer={
          <p>
            <Link
              href="/account"
              className="font-medium text-accent-deep hover:underline"
            >
              返回账号
            </Link>
          </p>
        }
      />
    </AuthShell>
  );
}
