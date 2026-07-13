"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { VipBadge } from "@/components/VipBadge";
import type { SessionUser } from "@/lib/auth";

type PromoStatus = "pending" | "rewarded" | "rejected";

type PromoSubmission = {
  id: number;
  videoUrl: string;
  likesClaimed: number | null;
  note: string | null;
  status: PromoStatus;
  monthsGranted: number;
  adminNote: string | null;
  createdAt: string | null;
};

const STATUS_LABEL: Record<PromoStatus, string> = {
  pending: "审核中",
  rewarded: "已发放",
  rejected: "已驳回",
};

function vipSummary(user: SessionUser): string {
  if (!user.isVip) return "未开通会员";
  if (user.isPermanentVip) return "永久会员";
  if (user.vipExpiresAt) {
    return `会员至 ${new Date(user.vipExpiresAt).toLocaleDateString("zh-CN")}`;
  }
  return "会员";
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path =
      u.pathname.length > 28 ? `${u.pathname.slice(0, 28)}…` : u.pathname;
    return `${u.hostname}${path === "/" ? "" : path}`;
  } catch {
    return url.length > 52 ? `${url.slice(0, 52)}…` : url;
  }
}

export default function AccountPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [likesClaimed, setLikesClaimed] = useState("");
  const [note, setNote] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const loadSubmissions = useCallback(async () => {
    const res = await fetch("/api/promo/submissions");
    const data = await res.json();
    if (res.ok && data.ok) {
      setSubmissions(data.submissions ?? []);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (data) => {
        const u = data.user ?? null;
        setUser(u);
        if (u) await loadSubmissions();
      })
      .finally(() => setLoaded(true));
  }, [loadSubmissions]);

  async function onPromoSubmit(e: FormEvent) {
    e.preventDefault();
    setPromoError("");
    setPromoMessage("");
    setPromoBusy(true);
    try {
      const likes =
        likesClaimed.trim() === "" ? null : Number(likesClaimed.trim());
      const res = await fetch("/api/promo/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          likesClaimed: Number.isFinite(likes) ? likes : null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPromoError(data.error || "提交失败");
        return;
      }
      setPromoMessage(data.message || "已提交");
      setVideoUrl("");
      setLikesClaimed("");
      setNote("");
      await loadSubmissions();
    } catch {
      setPromoError("网络错误");
    } finally {
      setPromoBusy(false);
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
        <div className="mx-auto max-w-3xl animate-rise">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            我的账号
          </h1>
          <p className="mt-4 text-muted">
            你尚未登录。{" "}
            <Link href="/login" className="text-accent-deep hover:underline">
              去登录
            </Link>
          </p>
        </div>
      </PageShell>
    );
  }

  const isAdmin = user.username.toLowerCase() === "channg";
  const links = [
    { href: "/courses", label: "课程下载" },
    { href: "/redeem", label: "兑换会员" },
    { href: "/#download", label: "下载客户端" },
    { href: "/change-password", label: "修改密码" },
    ...(isAdmin ? [{ href: "/admin/promo", label: "宣传后台" }] : []),
  ];

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <header className="animate-rise">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            我的账号
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-xl font-medium text-ink">
              {user.nickname || user.username}
            </p>
            {user.isVip ? (
              <span className="inline-flex items-center gap-1 text-accent-deep">
                <VipBadge size={14} />
                <span className="text-sm font-medium">会员</span>
              </span>
            ) : null}
          </div>
          {user.nickname ? (
            <p className="mt-1 text-sm text-muted">@{user.username}</p>
          ) : null}
          <p className="mt-3 text-muted">
            {vipSummary(user)}
            <span className="mx-2 text-line">·</span>
            注册于{" "}
            {user.createdAt
              ? new Date(user.createdAt).toLocaleDateString("zh-CN")
              : "—"}
          </p>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[15px] text-accent-deep hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="animate-rise-delay-1 mt-14 border-t border-line pt-12">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink">
            宣传有礼
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            拍短视频宣传「宝贝英语」，视频中出现本程序。按点赞数发放会员：每 1
            个赞送 1 个月。提交链接后等待审核；也可加微信 535938559 沟通。
          </p>

          <form onSubmit={onPromoSubmit} className="mt-8 max-w-2xl space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">短视频链接</span>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://…"
                required
                maxLength={500}
                className="w-full rounded-2xl border border-line bg-white/90 px-4 py-3 text-ink outline-none transition focus:border-accent"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">
                  点赞数（可选）
                </span>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={likesClaimed}
                  onChange={(e) => setLikesClaimed(e.target.value)}
                  placeholder="例如 12"
                  className="w-full rounded-2xl border border-line bg-white/90 px-4 py-3 text-ink outline-none transition focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">备注（可选）</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="平台 / 说明"
                  maxLength={255}
                  className="w-full rounded-2xl border border-line bg-white/90 px-4 py-3 text-ink outline-none transition focus:border-accent"
                />
              </label>
            </div>

            {promoError ? (
              <p className="rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
                {promoError}
              </p>
            ) : null}
            {promoMessage ? (
              <p className="rounded-xl bg-[#e8fff8] px-3 py-2 text-sm text-accent-deep">
                {promoMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={promoBusy}
              className="rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white transition hover:bg-accent-deep disabled:opacity-60"
            >
              {promoBusy ? "提交中…" : "提交投稿"}
            </button>
          </form>

          {submissions.length > 0 ? (
            <div className="mt-12 max-w-2xl">
              <h3 className="text-sm font-medium text-ink">我的投稿</h3>
              <ul className="mt-2">
                {submissions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between gap-6 border-b border-line py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={s.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-[15px] text-ink hover:text-accent-deep"
                        title={s.videoUrl}
                      >
                        {shortenUrl(s.videoUrl)}
                      </a>
                      <p className="mt-0.5 text-xs text-muted">
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleDateString("zh-CN")
                          : "—"}
                        {s.likesClaimed != null
                          ? ` · ${s.likesClaimed} 赞`
                          : ""}
                        {s.status === "rewarded"
                          ? ` · +${s.monthsGranted} 个月`
                          : ""}
                        {s.adminNote ? ` · ${s.adminNote}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm ${
                        s.status === "rewarded"
                          ? "text-accent-deep"
                          : s.status === "rejected"
                            ? "text-[#c24b1e]"
                            : "text-muted"
                      }`}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
