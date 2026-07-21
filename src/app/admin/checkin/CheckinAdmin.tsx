"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageShell } from "@/components/PageShell";
import type { CheckinParticipant, CheckinStatus } from "@/lib/checkin";

const CHECKIN_TOTAL_DAYS = 5;

const STATUS_LABEL: Record<
  CheckinStatus,
  { text: string; className: string }
> = {
  active: { text: "进行中", className: "bg-[#eaf2ff] text-accent-deep" },
  completed: { text: "已完成", className: "bg-[#e8fff8] text-[#1a7a5c]" },
  claimed: { text: "已领奖", className: "bg-[#eaf2ff] text-accent-deep" },
  failed: { text: "已失败", className: "bg-[#fff1eb] text-[#c24b1e]" },
};

function displayName(p: CheckinParticipant): string {
  return p.nickname || p.username || `用户 #${p.userId}`;
}

function dayMarks(p: CheckinParticipant): (string | null)[] {
  return [
    p.day1CompletedOn,
    p.day2CompletedOn,
    p.day3CompletedOn,
    p.day4CompletedOn,
    p.day5CompletedOn,
  ];
}

export function CheckinAdmin() {
  const { user, status: authStatus } = useAuth();
  const [participants, setParticipants] = useState<CheckinParticipant[]>([]);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [listLoaded, setListLoaded] = useState(false);

  const loadParticipants = useCallback(async () => {
    const res = await fetch("/api/admin/checkin");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setParticipants(data.participants ?? []);
    setError("");
  }, []);

  useEffect(() => {
    if (
      authStatus !== "ready" ||
      !user ||
      user.username.toLowerCase() !== "channg"
    ) {
      return;
    }
    let cancelled = false;
    setListLoaded(false);
    void loadParticipants().finally(() => {
      if (!cancelled) setListLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus, user, loadParticipants]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        (p.username?.toLowerCase().includes(q) ?? false) ||
        (p.nickname?.toLowerCase().includes(q) ?? false) ||
        String(p.userId).includes(q),
    );
  }, [participants, queryText]);

  const stats = useMemo(() => {
    let active = 0;
    let completed = 0;
    let claimed = 0;
    let failed = 0;
    for (const p of participants) {
      if (p.status === "active") active += 1;
      else if (p.status === "completed") completed += 1;
      else if (p.status === "claimed") claimed += 1;
      else if (p.status === "failed") failed += 1;
    }
    return { active, completed, claimed, failed };
  }, [participants]);

  if (authStatus === "loading") {
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
          打卡活动后台
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
          打卡活动后台
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted">仅管理员 channg 可访问</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          打卡活动后台
        </h1>
        <p className="mt-3 text-muted">
          查看「连续 {CHECKIN_TOTAL_DAYS}{" "}
          天赢永久会员」参与用户及已完成天数。数据来自客户端打卡表。
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            共 {participants.length} 人 · 进行中 {stats.active} · 已完成{" "}
            {stats.completed} · 已领奖 {stats.claimed} · 失败 {stats.failed}
          </p>
          <button
            type="button"
            onClick={() => void loadParticipants()}
            className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-ink hover:border-accent"
          >
            刷新
          </button>
          <Link
            href="/admin/promo"
            className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-ink"
          >
            宣传后台
          </Link>
        </div>

        <label className="mt-5 block max-w-sm">
          <span className="sr-only">搜索用户</span>
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="搜索用户名 / 昵称 / ID"
            className="w-full rounded-xl border border-line/10 bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}

        {!listLoaded ? (
          <p className="mt-8 text-sm text-muted">加载中…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-sm text-muted">
            {participants.length === 0 ? "暂无参与用户" : "没有匹配的用户"}
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-[1.25rem] border border-line/10 bg-white/85 shadow-[0_12px_36px_rgba(11,31,51,0.06)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line/10 text-xs text-muted">
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">完成天数</th>
                  <th className="px-4 py-3 font-medium">每日进度</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">开始日期</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status = STATUS_LABEL[p.status];
                  const marks = dayMarks(p);
                  return (
                    <tr
                      key={`${p.userId}-${p.challengeId}`}
                      className="border-b border-line/70 last:border-b-0"
                    >
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-medium text-ink">
                          {displayName(p)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          @{p.username ?? "—"} · #{p.userId}
                        </p>
                        {p.status === "failed" && p.failReason ? (
                          <p className="mt-1 max-w-[16rem] text-xs text-[#c24b1e]">
                            {p.failReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tabular-nums text-ink">
                          {p.completedDays}
                        </span>
                        <span className="text-muted">
                          {" "}
                          / {CHECKIN_TOTAL_DAYS}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {marks.map((date, i) => (
                            <span
                              key={i}
                              title={
                                date
                                  ? `第 ${i + 1} 天 · ${date}`
                                  : `第 ${i + 1} 天未完成`
                              }
                              className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-xs font-medium ${
                                date
                                  ? "bg-accent/10 text-accent-deep"
                                  : "bg-bg text-muted"
                              }`}
                            >
                              {i + 1}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.text}
                        </span>
                        {p.claimedAt ? (
                          <p className="mt-1 text-xs text-muted">
                            领奖{" "}
                            {new Date(p.claimedAt).toLocaleDateString("zh-CN")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 align-top text-muted">
                        {p.startedOn ?? "—"}
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
