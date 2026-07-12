"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { VipBadge, VipShield } from "@/components/VipBadge";
import type { SessionUser } from "@/lib/auth";

export default function AccountPage() {
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
      <PageShell>
        <p className="text-muted">加载中…</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          我的账号
        </h1>
        <p className="mt-4 text-muted">
          你尚未登录。{" "}
          <Link href="/login" className="text-accent-deep hover:underline">
            去登录
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
        我的账号
      </h1>
      <div
        className={`mt-8 max-w-lg space-y-5 rounded-[1.5rem] border bg-white/85 p-7 shadow-[0_20px_50px_rgba(11,31,51,0.08)] ${
          user.isVip
            ? "border-accent/35 ring-1 ring-accent/15"
            : "border-white/40"
        }`}
      >
        <div>
          <p className="text-sm text-muted">用户名</p>
          <p className="mt-1 flex items-center gap-2 text-lg text-ink">
            <span>{user.username}</span>
            {user.isVip ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-sm font-medium text-accent-deep">
                <VipBadge size={14} className="text-accent-deep" />
                会员
              </span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">注册时间</p>
          <p className="mt-1 text-lg text-ink">
            {user.createdAt
              ? new Date(user.createdAt).toLocaleString("zh-CN")
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">会员状态</p>
          {user.isVip ? (
            <p className="mt-1 flex items-center gap-2 text-lg text-ink">
              <VipShield size={20} className="shrink-0 text-accent-deep" />
              <span>
                {user.isPermanentVip
                  ? "永久会员"
                  : user.vipExpiresAt
                    ? `有效至 ${new Date(user.vipExpiresAt).toLocaleString("zh-CN")}`
                    : "会员"}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-lg text-ink">未开通</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/change-password"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-deep"
        >
          修改密码
        </Link>
        <Link
          href="/courses"
          className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
        >
          课程下载
        </Link>
        <Link
          href="/redeem"
          className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
        >
          兑换码
        </Link>
        <Link
          href="/#download"
          className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
        >
          下载客户端
        </Link>
      </div>
    </PageShell>
  );
}
