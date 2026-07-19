"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type PromoStatus = "pending" | "rewarded" | "rejected";

type PromoSubmissionDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  videoUrl: string;
  likesClaimed: number | null;
  note: string | null;
  status: PromoStatus;
  monthsGranted: number;
  adminNote: string | null;
  rewardedAt: string | null;
  createdAt: string | null;
};

const STATUS_LABEL: Record<
  PromoStatus,
  { text: string; className: string }
> = {
  pending: { text: "待审核", className: "text-warm" },
  rewarded: { text: "已发放", className: "text-accent-deep" },
  rejected: { text: "已驳回", className: "text-[#c24b1e]" },
};

export function PromoAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submissions, setSubmissions] = useState<PromoSubmissionDto[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [monthsById, setMonthsById] = useState<Record<number, number>>({});
  const [noteById, setNoteById] = useState<Record<number, string>>({});

  const loadSubmissions = useCallback(async () => {
    const res = await fetch("/api/admin/promo");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setSubmissions(data.submissions ?? []);
    setError("");
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (data) => {
        const u = data.user ?? null;
        setUser(u);
        if (u?.username?.toLowerCase() === "channg") {
          await loadSubmissions();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadSubmissions]);

  async function runAction(
    id: number,
    action: "reward" | "reject",
  ) {
    setError("");
    setMessage("");
    setBusyId(id);
    try {
      const months = monthsById[id] ?? 1;
      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          months: action === "reward" ? months : undefined,
          adminNote: noteById[id] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "操作失败");
        return;
      }
      setMessage(data.message || "操作成功");
      await loadSubmissions();
    } catch {
      setError("网络错误");
    } finally {
      setBusyId(null);
    }
  }

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
          宣传投稿后台
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
          宣传投稿后台
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted">仅管理员 channg 可访问</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          宣传投稿后台
        </h1>
        <p className="mt-3 text-muted">
          审核用户提交的短视频链接。按点赞数发放会员：每 1 个赞对应 1
          个月（按 30 天计）。已发放的投稿会标记为「已发放」。
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            共 {submissions.length} 条 · 待审核 {pendingCount} 条
          </p>
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-ink hover:border-accent"
          >
            刷新
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-xl bg-[#e8fff8] px-3 py-2 text-sm text-accent-deep">
            {message}
          </p>
        ) : null}

        {submissions.length === 0 ? (
          <p className="mt-8 text-sm text-muted">暂无投稿</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {submissions.map((s) => {
              const status = STATUS_LABEL[s.status];
              const months =
                monthsById[s.id] ??
                (s.likesClaimed != null && s.likesClaimed > 0
                  ? Math.min(s.likesClaimed, 120)
                  : 1);
              return (
                <li
                  key={s.id}
                  className="rounded-[1.25rem] border border-line/10 bg-white/85 p-5 shadow-[0_12px_36px_rgba(11,31,51,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-ink">
                        <span className="font-medium">
                          {s.nickname || s.username}
                        </span>
                        <span className="ml-2 text-sm text-muted">
                          @{s.username} · #{s.id}
                        </span>
                      </p>
                      <a
                        href={s.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-sm text-accent-deep hover:underline"
                      >
                        {s.videoUrl}
                      </a>
                      <p className="text-sm text-muted">
                        自称点赞{" "}
                        {s.likesClaimed != null ? s.likesClaimed : "未填"}
                        {s.note ? ` · 备注：${s.note}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        提交于{" "}
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleString("zh-CN")
                          : "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full bg-bg px-3 py-1 text-sm font-medium ${status.className}`}
                    >
                      {status.text}
                      {s.status === "rewarded"
                        ? ` · ${s.monthsGranted} 个月`
                        : ""}
                    </span>
                  </div>

                  {s.adminNote ? (
                    <p className="mt-3 text-sm text-muted">
                      管理员备注：{s.adminNote}
                    </p>
                  ) : null}

                  {s.status === "pending" ? (
                    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line/70 pt-4">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">
                          发放月数
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={months}
                          onChange={(e) =>
                            setMonthsById((prev) => ({
                              ...prev,
                              [s.id]: Number(e.target.value),
                            }))
                          }
                          className="w-24 rounded-xl border border-line/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <label className="block min-w-[12rem] flex-1">
                        <span className="mb-1 block text-xs text-muted">
                          备注（可选）
                        </span>
                        <input
                          type="text"
                          value={noteById[s.id] ?? ""}
                          onChange={(e) =>
                            setNoteById((prev) => ({
                              ...prev,
                              [s.id]: e.target.value,
                            }))
                          }
                          placeholder="审核说明"
                          maxLength={500}
                          className="w-full rounded-xl border border-line/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(s.id, "reward")}
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-deep disabled:opacity-50"
                      >
                        {busyId === s.id ? "处理中…" : "发放会员"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(s.id, "reject")}
                        className="rounded-full border border-[#e8c4b8] bg-[#fff1eb] px-4 py-2 text-sm text-[#c24b1e] hover:border-[#c24b1e] disabled:opacity-50"
                      >
                        驳回
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
