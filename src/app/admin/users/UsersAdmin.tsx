"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type ClientUsage = "none" | "client" | "web" | "both";

type AdminUser = SessionUser & {
  tokenVersion: number;
  hasClient: boolean;
  hasWeb: boolean;
  clientUsage: ClientUsage;
  lastNotificationAt: string | null;
  notificationHitCount: number;
};

const USAGE_LABEL: Record<ClientUsage, string> = {
  none: "未检测到",
  client: "客户端",
  web: "在线版",
  both: "都使用了",
};

function vipLabel(u: AdminUser): string {
  if (!u.isVip) return "非会员";
  if (u.isPermanentVip) return "永久会员";
  if (u.vipExpiresAt) {
    return `至 ${new Date(u.vipExpiresAt).toLocaleDateString("zh-CN")}`;
  }
  return "会员";
}

function usageLabel(u: AdminUser): ClientUsage {
  if (u.clientUsage) return u.clientUsage;
  return u.hasClient && u.hasWeb
    ? "both"
    : u.hasClient
      ? "client"
      : u.hasWeb
        ? "web"
        : "none";
}

export function UsersAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setUsers(data.users ?? []);
    setError("");
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (data) => {
        const u = data.user ?? null;
        setUser(u);
        if (u?.username?.toLowerCase() === "channg") {
          await loadUsers();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.nickname?.toLowerCase().includes(q) ?? false) ||
        String(u.id).includes(q),
    );
  }, [users, queryText]);

  const vipCount = useMemo(
    () => users.filter((u) => u.isVip).length,
    [users],
  );

  const usageCounts = useMemo(() => {
    let clientOnly = 0;
    let webOnly = 0;
    let both = 0;
    for (const u of users) {
      const usage = usageLabel(u);
      if (usage === "client") clientOnly += 1;
      else if (usage === "web") webOnly += 1;
      else if (usage === "both") both += 1;
    }
    return { clientOnly, webOnly, both };
  }, [users]);

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
          用户后台
        </h1>
        <p className="mt-4 text-muted">
          请先以管理员账号{" "}
          <Link href="/login" className="text-accent-deep hover:underline">
            登录
          </Link>
          。
        </p>
      </PageShell>
    );
  }

  if (user.username.toLowerCase() !== "channg") {
    return (
      <PageShell>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          用户后台
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-amber-800/80">仅本地开发可用 · 用户 channg</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          用户后台
        </h1>
        <p className="mt-3 text-muted">
          查看全部注册用户信息。共 {users.length} 人，其中会员 {vipCount}{" "}
          人；客户端 {usageCounts.clientOnly} 人，在线版 {usageCounts.webOnly}{" "}
          人，都使用了 {usageCounts.both} 人。
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <label className="block min-w-[14rem] flex-1">
            <span className="mb-1.5 block text-sm text-muted">搜索</span>
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="用户名 / 昵称 / ID"
              className="w-full rounded-2xl border border-line bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-accent"
          >
            刷新
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            {users.length === 0 ? "暂无用户" : "无匹配用户"}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">用户名</th>
                  <th className="py-2 pr-3 font-medium">昵称</th>
                  <th className="py-2 pr-3 font-medium">客户端</th>
                  <th className="py-2 pr-3 font-medium">会员</th>
                  <th className="py-2 pr-3 font-medium">到期时间</th>
                  <th className="py-2 pr-3 font-medium">注册时间</th>
                  <th className="py-2 font-medium">token_version</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const usage = usageLabel(u);
                  return (
                    <tr key={u.id} className="border-b border-line/60">
                      <td className="py-2.5 pr-3 align-top text-muted">{u.id}</td>
                      <td className="py-2.5 pr-3 align-top font-medium text-ink">
                        {u.username}
                      </td>
                      <td className="py-2.5 pr-3 align-top text-muted">
                        {u.nickname || "—"}
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        {usage === "none" ? (
                          <span className="text-muted">{USAGE_LABEL.none}</span>
                        ) : (
                          <span className="text-accent-deep">
                            {USAGE_LABEL[usage]}
                            <span className="mt-0.5 block text-xs font-normal text-muted">
                              最近 {u.lastNotificationAt ?? "—"} ·{" "}
                              {u.notificationHitCount} 次
                            </span>
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 pr-3 align-top ${
                          u.isVip ? "text-accent-deep" : "text-muted"
                        }`}
                      >
                        {vipLabel(u)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 align-top text-muted">
                        {u.isPermanentVip
                          ? "永久"
                          : u.vipExpiresAt
                            ? new Date(u.vipExpiresAt).toLocaleString("zh-CN")
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 align-top text-muted">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleString("zh-CN")
                          : "—"}
                      </td>
                      <td className="py-2.5 align-top text-muted">
                        {u.tokenVersion}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
