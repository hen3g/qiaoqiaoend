"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
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

const STATUS_STYLE: Record<PromoStatus, string> = {
  pending: "bg-[#fff6eb] text-warm",
  rewarded: "bg-[#eaf2ff] text-accent-deep",
  rejected: "bg-[#fff1eb] text-[#c24b1e]",
};

function vipSummary(user: SessionUser): string {
  const vipPart = !user.isVip
    ? "未开通会员"
    : user.isPermanentVip
      ? "永久会员"
      : user.vipExpiresAt
        ? `会员至 ${new Date(user.vipExpiresAt).toLocaleDateString("zh-CN")}`
        : "会员";
  return `${vipPart} · 钻石 ${user.diamonds ?? 0}`;
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

function AccountSkeleton() {
  return (
    <div className="mx-auto max-w-2xl" aria-busy aria-label="加载中">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/65 p-6 shadow-[0_20px_50px_rgba(11,21,36,0.06)] backdrop-blur-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="skeleton h-16 w-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <div className="skeleton h-7 w-40 rounded-lg" />
            <div className="skeleton h-4 w-56 max-w-full rounded" />
            <div className="skeleton h-4 w-32 rounded" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-11 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/65 p-6 shadow-[0_20px_50px_rgba(11,21,36,0.06)] backdrop-blur-sm sm:p-8">
        <div className="skeleton h-6 w-28 rounded-lg" />
        <div className="skeleton mt-3 h-4 w-full max-w-md rounded" />
        <div className="mt-6 space-y-3">
          <div className="skeleton h-11 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-11 rounded-xl" />
            <div className="skeleton h-11 rounded-xl" />
          </div>
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, status, setUser } = useAuth();
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [promoLoaded, setPromoLoaded] = useState(false);
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
    if (status !== "ready" || !user) {
      setPromoLoaded(false);
      return;
    }
    let cancelled = false;
    setPromoLoaded(false);
    void loadSubmissions().finally(() => {
      if (!cancelled) setPromoLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [status, user, loadSubmissions]);

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

  return (
    <PageShell>
      <div className="min-h-[min(72vh,44rem)]">
        {status === "loading" ? (
          <AccountSkeleton />
        ) : !user ? (
          <div className="animate-fade-in mx-auto max-w-xl pt-6 sm:pt-10">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 p-8 shadow-[0_24px_60px_rgba(11,21,36,0.08)] backdrop-blur-sm sm:p-10">
              <p className="text-sm tracking-wide text-muted">账号中心</p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
                登录后查看
              </h1>
              <p className="mt-3 max-w-sm text-muted">
                管理昵称、会员状态与宣传投稿。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-deep"
                >
                  去登录
                </Link>
                <Link
                  href="/register"
                  className="inline-flex rounded-xl border border-line/10 bg-white/80 px-6 py-3 text-sm font-medium text-ink transition hover:border-accent hover:text-accent-deep"
                >
                  注册账号
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <AccountContent
            user={user}
            links={buildLinks(user)}
            submissions={submissions}
            promoLoaded={promoLoaded}
            videoUrl={videoUrl}
            likesClaimed={likesClaimed}
            note={note}
            promoError={promoError}
            promoMessage={promoMessage}
            promoBusy={promoBusy}
            onOpenNickname={openNicknameDialog}
            onPromoSubmit={onPromoSubmit}
            setVideoUrl={setVideoUrl}
            setLikesClaimed={setLikesClaimed}
            setNote={setNote}
          />
        )}
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
            className="animate-fade-in w-full max-w-[22rem] rounded-2xl border border-line/10 bg-white p-5 shadow-[0_24px_60px_rgba(11,21,36,0.18)]"
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

function buildLinks(user: SessionUser) {
  const isAdmin = user.username.toLowerCase() === "channg";
  if (isAdmin || user.isPromoter) {
    return [
      {
        href: "/admin",
        label: isAdmin ? "管理后台" : "推广后台",
      },
    ];
  }
  return [];
}

function AccountContent({
  user,
  links,
  submissions,
  promoLoaded,
  videoUrl,
  likesClaimed,
  note,
  promoError,
  promoMessage,
  promoBusy,
  onOpenNickname,
  onPromoSubmit,
  setVideoUrl,
  setLikesClaimed,
  setNote,
}: {
  user: SessionUser;
  links: { href: string; label: string }[];
  submissions: PromoSubmission[];
  promoLoaded: boolean;
  videoUrl: string;
  likesClaimed: string;
  note: string;
  promoError: string;
  promoMessage: string;
  promoBusy: boolean;
  onOpenNickname: () => void;
  onPromoSubmit: (e: FormEvent) => void;
  setVideoUrl: (v: string) => void;
  setLikesClaimed: (v: string) => void;
  setNote: (v: string) => void;
}) {
  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 shadow-[0_24px_60px_rgba(11,21,36,0.08)] backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-[#dce9ff] via-[#eef4ff] to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-warm/15 blur-3xl"
        />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start gap-4 sm:gap-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep font-[family-name:var(--font-display)] text-2xl font-semibold text-white shadow-[0_12px_32px_var(--glow)]"
              aria-hidden
            >
              {monogram(user)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink sm:text-[1.85rem]">
                  {displayName(user)}
                </h1>
                <button
                  type="button"
                  onClick={onOpenNickname}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-white hover:text-accent-deep"
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
              </div>
              <p className="mt-1 text-sm text-muted">@{user.username}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    user.isVip
                      ? "bg-[#eaf2ff] text-accent-deep"
                      : "bg-white/90 text-muted"
                  }`}
                >
                  {user.isVip ? <VipBadge size={13} /> : null}
                  {vipSummary(user)}
                </span>
                <span className="text-xs text-muted">
                  {user.createdAt
                    ? `${new Date(user.createdAt).toLocaleDateString("zh-CN")} 注册`
                    : "注册时间未知"}
                </span>
              </div>
            </div>
          </div>

          <nav
            className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="账号快捷入口"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-line/10 bg-white/80 px-3 py-2.5 text-center text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-white hover:text-accent-deep"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 p-6 shadow-[0_24px_60px_rgba(11,21,36,0.08)] backdrop-blur-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-ink">
              宣传有礼
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              拍短视频宣传「敲敲英语」并露出本程序，提交链接等待审核。也可加微信{" "}
              <span className="font-medium text-ink">535938559</span> 沟通。
            </p>
          </div>
          <p className="rounded-full bg-[#fff6eb] px-3 py-1 text-xs font-medium text-warm">
            1 赞 = 1 个月会员
          </p>
        </div>

        <form onSubmit={onPromoSubmit} className="mt-6 space-y-3">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="短视频链接 https://…"
            required
            maxLength={500}
            aria-label="短视频链接"
            className="w-full rounded-xl border border-line/10 bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
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
              className="w-full rounded-xl border border-line/10 bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
              maxLength={255}
              aria-label="备注"
              className="w-full rounded-xl border border-line/10 bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
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

        <div className="mt-8 border-t border-line/10 pt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
            我的投稿
          </h3>
          {!promoLoaded ? (
            <div className="mt-4 space-y-3" aria-busy aria-label="投稿加载中">
              <div className="skeleton h-14 w-full rounded-xl" />
              <div className="skeleton h-14 w-full rounded-xl" />
            </div>
          ) : submissions.length === 0 ? (
            <p className="mt-4 text-sm text-muted">还没有投稿，提交第一条试试。</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {submissions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-line/10 bg-white/80 px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={s.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-ink transition hover:text-accent-deep"
                      title={s.videoUrl}
                    >
                      {shortenUrl(s.videoUrl)}
                    </a>
                    <p className="mt-1 text-xs text-muted">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleDateString("zh-CN")
                        : "—"}
                      {s.likesClaimed != null ? ` · ${s.likesClaimed} 赞` : ""}
                      {s.status === "rewarded"
                        ? ` · +${s.monthsGranted} 个月`
                        : ""}
                      {s.adminNote ? ` · ${s.adminNote}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[s.status]}`}
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
