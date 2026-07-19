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

function displayName(user: SessionUser): string {
  return user.nickname || user.username;
}

function monogram(user: SessionUser): string {
  const name = displayName(user).trim();
  return name.slice(0, 1).toUpperCase() || "?";
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
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameBusy, setNicknameBusy] = useState(false);
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

  useEffect(() => {
    if (!nicknameOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !nicknameBusy) {
        setNicknameOpen(false);
        setNicknameError("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nicknameOpen, nicknameBusy]);

  function openNicknameDialog() {
    setNickname(user?.nickname || "");
    setNicknameError("");
    setNicknameOpen(true);
  }

  function closeNicknameDialog() {
    if (nicknameBusy) return;
    setNicknameOpen(false);
    setNicknameError("");
  }

  async function onNicknameSubmit(e: FormEvent) {
    e.preventDefault();
    setNicknameError("");
    setNicknameBusy(true);
    try {
      const res = await fetch("/api/auth/change-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNicknameError(data.error || "修改失败");
        return;
      }
      if (data.user) setUser(data.user);
      setNicknameOpen(false);
    } catch {
      setNicknameError("网络错误");
    } finally {
      setNicknameBusy(false);
    }
  }

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
        <div className="mx-auto max-w-xl animate-rise pt-8">
          <p className="text-sm tracking-wide text-muted">账号</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
            登录后查看
          </h1>
          <p className="mt-3 text-muted">管理昵称、会员状态与宣传投稿。</p>
          <Link
            href="/login"
            className="mt-8 inline-flex rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-deep"
          >
            去登录
          </Link>
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
      <div className="mx-auto max-w-xl">
        {/* Identity */}
        <header className="animate-rise pt-4 sm:pt-8">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep font-[family-name:var(--font-display)] text-xl font-semibold text-white shadow-[0_10px_28px_var(--glow)]"
              aria-hidden
            >
              {monogram(user)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
                  {displayName(user)}
                </h1>
                <button
                  type="button"
                  onClick={openNicknameDialog}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-white/80 hover:text-accent-deep"
                  aria-label="修改昵称"
                  title="修改昵称"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.5 6.5l3 3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                {user.isVip ? (
                  <span className="inline-flex items-center gap-1 text-accent-deep">
                    <VipBadge size={14} />
                    <span className="text-xs font-medium">会员</span>
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm text-muted">
                @{user.username}
                <span className="mx-2 text-line/10">·</span>
                {vipSummary(user)}
                <span className="mx-2 text-line/10">·</span>
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("zh-CN")
                  : "—"}{" "}
                注册
              </p>
            </div>
          </div>

          <nav
            className="mt-8 flex flex-wrap gap-x-1 gap-y-1 border-y border-line/10 py-3"
            aria-label="账号快捷入口"
          >
            {links.map((link, i) => (
              <span key={link.href} className="inline-flex items-center">
                {i > 0 ? (
                  <span className="mx-2 select-none text-line/10" aria-hidden>
                    /
                  </span>
                ) : null}
                <Link
                  href={link.href}
                  className="text-sm text-ink/80 transition hover:text-accent-deep"
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </header>

        {/* Promo */}
        <section className="animate-rise-delay-1 mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-ink">
              宣传有礼
            </h2>
            <p className="text-xs text-muted">1 赞 = 1 个月会员</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            拍短视频宣传「宝贝英语」并露出本程序，提交链接等待审核。也可加微信{" "}
            <span className="text-ink">535938559</span> 沟通。
          </p>

          <form onSubmit={onPromoSubmit} className="mt-6 space-y-3">
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="短视频链接 https://…"
              required
              maxLength={500}
              aria-label="短视频链接"
              className="w-full rounded-xl border border-line/10 bg-white/80 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                max={10000000}
                value={likesClaimed}
                onChange={(e) => setLikesClaimed(e.target.value)}
                placeholder="点赞数（可选）"
                aria-label="点赞数"
                className="w-full rounded-xl border border-line/10 bg-white/80 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注（可选）"
                maxLength={255}
                aria-label="备注"
                className="w-full rounded-xl border border-line/10 bg-white/80 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
              />
            </div>

            {promoError ? (
              <p className="text-sm text-[#c24b1e]">{promoError}</p>
            ) : null}
            {promoMessage ? (
              <p className="text-sm text-accent-deep">{promoMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={promoBusy}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-deep disabled:opacity-60"
            >
              {promoBusy ? "提交中…" : "提交投稿"}
            </button>
          </form>

          {submissions.length > 0 ? (
            <div className="mt-10">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
                我的投稿
              </h3>
              <ul className="mt-3">
                {submissions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between gap-4 border-t border-line/70 py-3 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={s.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-ink transition hover:text-accent-deep"
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
                      className={`shrink-0 text-xs ${
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

      {nicknameOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1524]/35 p-4 backdrop-blur-[2px]"
          onClick={closeNicknameDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nickname-dialog-title"
            className="animate-rise w-full max-w-[22rem] rounded-2xl border border-line/10 bg-white p-5 shadow-[0_24px_60px_rgba(11,21,36,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="nickname-dialog-title"
              className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink"
            >
              修改昵称
            </h2>
            <p className="mt-1 text-sm text-muted">不可与其他用户重复。</p>
            <form onSubmit={onNicknameSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="新昵称"
                required
                maxLength={32}
                autoFocus
                aria-label="昵称"
                className="w-full rounded-xl border border-line/10 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
              />
              {nicknameError ? (
                <p className="text-sm text-[#c24b1e]">{nicknameError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeNicknameDialog}
                  disabled={nicknameBusy}
                  className="rounded-lg px-3.5 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={nicknameBusy}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-deep disabled:opacity-60"
                >
                  {nicknameBusy ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
