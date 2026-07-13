"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type DailyStat = {
  date: string;
  totalHits: number;
  loggedInHits: number;
  uniqueUsers: number;
};

type DailyUser = {
  userId: number;
  username: string | null;
  nickname: string | null;
  hitCount: number;
};

export function NotificationStatsAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [days, setDays] = useState<DailyStat[]>([]);
  const [today, setToday] = useState<DailyStat | null>(null);
  const [detailDate, setDetailDate] = useState("");
  const [users, setUsers] = useState<DailyUser[]>([]);
  const [error, setError] = useState("");

  const loadStats = useCallback(async (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetch(`/api/admin/notification-stats${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setDays(data.days ?? []);
    setToday(data.today ?? null);
    setDetailDate(data.detailDate ?? "");
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
          await loadStats();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadStats]);

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
          通知接口统计
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
          通知接口统计
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
          通知接口统计
        </h1>
        <p className="mt-3 text-muted">
          统计公开接口{" "}
          <code className="text-sm text-ink">GET /api/notifications</code>{" "}
          的调用。全部请求都会计入；若请求带登录态（Bearer / 网站
          Cookie），还会按用户 ID 去重估算日活。
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => void loadStats(detailDate || undefined)}
            className="rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-accent"
          >
            刷新
          </button>
          <Link
            href="/admin/notifications"
            className="rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-accent"
          >
            通知设置
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}

        {today ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white/70 px-4 py-4">
              <p className="text-sm text-muted">今日请求</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
                {today.totalHits}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white/70 px-4 py-4">
              <p className="text-sm text-muted">今日带登录请求</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
                {today.loggedInHits}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white/70 px-4 py-4">
              <p className="text-sm text-muted">今日独立用户</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-accent-deep">
                {today.uniqueUsers}
              </p>
            </div>
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">近 30 天</h2>
          {days.length === 0 ? (
            <p className="mt-4 text-sm text-muted">暂无数据</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">总请求</th>
                    <th className="py-2 pr-3 font-medium">带登录请求</th>
                    <th className="py-2 font-medium">独立用户</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr
                      key={d.date}
                      className={`border-b border-line/60 ${
                        d.date === detailDate ? "bg-accent/5" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-3 align-top">
                        <button
                          type="button"
                          onClick={() => void loadStats(d.date)}
                          className="text-accent-deep hover:underline"
                        >
                          {d.date}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 align-top text-ink">
                        {d.totalHits}
                      </td>
                      <td className="py-2.5 pr-3 align-top text-muted">
                        {d.loggedInHits}
                      </td>
                      <td className="py-2.5 align-top font-medium text-ink">
                        {d.uniqueUsers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">
            {detailDate || "今日"} 登录用户明细
          </h2>
          <p className="mt-2 text-sm text-muted">
            仅统计成功解析出用户 ID 的请求。客户端未带 Bearer / Cookie
            时不会出现在此列表。
          </p>
          {users.length === 0 ? (
            <p className="mt-4 text-sm text-muted">该日暂无登录用户记录</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 pr-3 font-medium">用户 ID</th>
                    <th className="py-2 pr-3 font-medium">用户名</th>
                    <th className="py-2 pr-3 font-medium">昵称</th>
                    <th className="py-2 font-medium">请求次数</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} className="border-b border-line/60">
                      <td className="py-2.5 pr-3 align-top text-muted">
                        {u.userId}
                      </td>
                      <td className="py-2.5 pr-3 align-top font-medium text-ink">
                        {u.username || "—"}
                      </td>
                      <td className="py-2.5 pr-3 align-top text-muted">
                        {u.nickname || "—"}
                      </td>
                      <td className="py-2.5 align-top text-ink">{u.hitCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
