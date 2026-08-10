"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type FeedbackType = "problem" | "promo";

type FeedbackSubmissionDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  type: FeedbackType;
  wechat: string;
  content: string;
  createdAt: string | null;
};

const TYPE_LABEL: Record<FeedbackType, { text: string; className: string }> = {
  problem: { text: "问题反馈", className: "text-warm" },
  promo: { text: "推广合作", className: "text-accent-deep" },
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function FeedbackAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submissions, setSubmissions] = useState<FeedbackSubmissionDto[]>([]);
  const [error, setError] = useState("");

  const loadSubmissions = useCallback(async () => {
    const res = await fetch("/api/admin/feedback");
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
          反馈合作
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
          反馈合作
        </h1>
        <p className="mt-4 text-muted">无权限查看此页面。</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            反馈合作
          </h1>
          <p className="mt-2 text-sm text-muted">
            共 {submissions.length} 条 · 新提交会同步 Bark 推送
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSubmissions()}
          className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:bg-wash"
        >
          刷新
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#c24b1e]">
          {error}
        </p>
      ) : null}

      {submissions.length === 0 ? (
        <p className="mt-8 text-muted">还没有反馈记录。</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {submissions.map((item) => {
            const typeMeta = TYPE_LABEL[item.type];
            const displayName =
              item.nickname?.trim() || item.username || `用户#${item.userId}`;
            return (
              <li
                key={item.id}
                className="rounded-[1.25rem] border border-line bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${typeMeta.className}`}
                    >
                      {typeMeta.text}
                    </span>
                    <span className="text-sm text-ink">{displayName}</span>
                    {item.username ? (
                      <span className="text-xs text-muted">
                        @{item.username}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted">
                    {formatTime(item.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-ink">
                  <span className="text-muted">微信：</span>
                  {item.wechat}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                  {item.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
