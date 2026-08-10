"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type DailyStat = {
  date: string;
  anonymous: number;
  ios: number;
  android: number;
  registrations: number;
};

export function StatsAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [days, setDays] = useState<DailyStat[]>([]);
  const [today, setToday] = useState<DailyStat | null>(null);
  const [detail, setDetail] = useState<DailyStat | null>(null);
  const [detailDate, setDetailDate] = useState("");
  const [error, setError] = useState("");

  const loadStats = useCallback(async (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetch(`/api/admin/stats${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setDays(data.days ?? []);
    setToday(data.today ?? null);
    setDetail(data.detail ?? null);
    setDetailDate(data.detailDate ?? "");
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
          日活统计
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
          日活统计
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  const cards = today
    ? [
        { label: "今日未登录", value: today.anonymous },
        { label: "今日登录 iOS", value: today.ios },
        { label: "今日登录 Android", value: today.android },
        { label: "今日注册", value: today.registrations },
      ]
    : [];

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted">仅管理员 channg 可访问</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          日活统计
        </h1>
        <p className="mt-3 text-muted">
          客户端每日上报一次：未登录按设备去重；登录后按用户去重并区分 iOS /
          Android。注册数为当日新建账号。
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => void loadStats(detailDate || undefined)}
            className="rounded-full border border-line/10 px-4 py-2.5 text-sm text-ink hover:border-accent"
          >
            刷新
          </button>
          <Link
            href="/admin/notification-stats"
            className="rounded-full border border-line/10 px-4 py-2.5 text-sm text-ink hover:border-accent"
          >
            通知统计
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}

        {cards.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-line/10 bg-white/70 px-4 py-4"
              >
                <p className="text-sm text-muted">{c.label}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {detail && detailDate !== today?.date ? (
          <div className="mt-6 rounded-2xl border border-line/10 bg-white/50 px-4 py-3 text-sm text-muted">
            已选日期 {detailDate}：未登录 {detail.anonymous} · iOS {detail.ios}{" "}
            · Android {detail.android} · 注册 {detail.registrations}
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">近 30 天</h2>
          {days.length === 0 ? (
            <p className="mt-4 text-sm text-muted">暂无数据</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line/10 text-muted">
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">未登录</th>
                    <th className="py-2 pr-3 font-medium">iOS</th>
                    <th className="py-2 pr-3 font-medium">Android</th>
                    <th className="py-2 font-medium">注册</th>
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
                        {d.anonymous}
                      </td>
                      <td className="py-2.5 pr-3 align-top text-ink">{d.ios}</td>
                      <td className="py-2.5 pr-3 align-top text-ink">
                        {d.android}
                      </td>
                      <td className="py-2.5 align-top font-medium text-ink">
                        {d.registrations}
                      </td>
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
