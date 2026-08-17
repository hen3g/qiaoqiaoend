"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CompanyShell } from "@/components/company/CompanyShell";
import styles from "@/components/company/company.module.css";
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

const STATUS_CHIP: Record<PromoStatus, string> = {
  pending: "account-chip--warm",
  rewarded: "account-chip--ok",
  rejected: "account-chip--bad",
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
    <div className={styles.account} aria-busy aria-label="加载中">
      <div className={styles["account-card"]}>
        <div className={styles["account-profile"]}>
          <div
            className={styles["skeleton-block"]}
            style={{ width: 64, height: 64, borderRadius: 16 }}
          />
          <div className={styles["account-meta"]}>
            <div
              className={styles["skeleton-block"]}
              style={{ height: 28, width: 160, marginBottom: 12 }}
            />
            <div
              className={styles["skeleton-block"]}
              style={{ height: 16, width: 220, marginBottom: 8 }}
            />
            <div
              className={styles["skeleton-block"]}
              style={{ height: 16, width: 120 }}
            />
          </div>
        </div>
      </div>
      <div className={styles["account-card"]}>
        <div
          className={styles["skeleton-block"]}
          style={{ height: 24, width: 112 }}
        />
        <div
          className={styles["skeleton-block"]}
          style={{ height: 16, width: "80%", marginTop: 12 }}
        />
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
    <CompanyShell>
      {status === "loading" ? (
        <AccountSkeleton />
      ) : !user ? (
        <div className={styles.account}>
          <div className={styles["account-card"]}>
            <p className={styles["account-handle"]}>账号中心</p>
            <h1>登录后查看</h1>
            <p className={styles["account-lead"]}>
              管理昵称、会员状态与宣传投稿。
            </p>
            <div style={{ marginTop: "1.5rem" }}>
              <Link
                href="/login"
                className={`${styles.btn} ${styles["btn--primary"]}`}
              >
                去登录
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

      {nicknameOpen ? (
        <div
          className={styles["account-dialog-backdrop"]}
          onClick={closeNicknameDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nickname-dialog-title"
            className={styles["account-dialog"]}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="nickname-dialog-title">修改昵称</h2>
            <p>不可与其他用户重复。</p>
            <form onSubmit={onNicknameSubmit} className={styles["account-form"]}>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="新昵称"
                required
                maxLength={32}
                autoFocus
                aria-label="昵称"
                className={styles["form-input"]}
              />
              {nicknameError ? (
                <p className={styles["form-error"]}>{nicknameError}</p>
              ) : null}
              <div className={styles["account-dialog-actions"]}>
                <button
                  type="button"
                  onClick={closeNicknameDialog}
                  disabled={nicknameBusy}
                  className={`${styles.btn} ${styles["btn--ghost"]}`}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={nicknameBusy}
                  className={`${styles.btn} ${styles["btn--primary"]}`}
                >
                  {nicknameBusy ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </CompanyShell>
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
    <div className={styles.account}>
      <section className={styles["account-card"]}>
        <div className={styles["account-profile"]}>
          <div className={styles["account-avatar"]} aria-hidden>
            {monogram(user)}
          </div>
          <div className={styles["account-meta"]}>
            <div className={styles["account-name-row"]}>
              <h1>{displayName(user)}</h1>
              <button
                type="button"
                onClick={onOpenNickname}
                className={styles["account-edit"]}
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
            <p className={styles["account-handle"]}>@{user.username}</p>
            <div className={styles["account-chips"]}>
              <span
                className={`${styles["account-chip"]}${
                  user.isVip ? ` ${styles["account-chip--vip"]}` : ""
                }`}
              >
                {user.isVip ? <VipBadge size={13} /> : null}
                {vipSummary(user)}
              </span>
              <span className={styles["account-handle"]}>
                {user.createdAt
                  ? `${new Date(user.createdAt).toLocaleDateString("zh-CN")} 注册`
                  : "注册时间未知"}
              </span>
            </div>
          </div>
        </div>

        {links.length > 0 ? (
          <nav className={styles["account-links"]} aria-label="账号快捷入口">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles["account-link"]}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>

      <section className={styles["account-card"]}>
        <div className={styles["account-head"]}>
          <div>
            <h2>宣传有礼</h2>
            <p className={styles["account-lead"]}>
              拍短视频宣传「言词科技」并露出本程序，提交链接等待审核。也可加微信{" "}
              <span className={styles.legal__term}>535938559</span> 沟通。
            </p>
          </div>
          <p className={`${styles["account-chip"]} ${styles["account-chip--warm"]}`}>
            1 赞 = 1 个月会员
          </p>
        </div>

        <form onSubmit={onPromoSubmit} className={styles["account-form"]}>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="短视频链接 https://…"
            required
            maxLength={500}
            aria-label="短视频链接"
            className={styles["form-input"]}
          />
          <div className={styles["account-form-grid"]}>
            <input
              type="number"
              min={0}
              max={10000000}
              value={likesClaimed}
              onChange={(e) => setLikesClaimed(e.target.value)}
              placeholder="点赞数（可选）"
              aria-label="点赞数"
              className={styles["form-input"]}
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
              maxLength={255}
              aria-label="备注"
              className={styles["form-input"]}
            />
          </div>

          {promoError ? (
            <p className={styles["form-error"]}>{promoError}</p>
          ) : null}
          {promoMessage ? (
            <p className={styles["form-ok"]}>{promoMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={promoBusy}
            className={`${styles.btn} ${styles["btn--primary"]}`}
          >
            {promoBusy ? "提交中…" : "提交投稿"}
          </button>
        </form>

        <h3 className={styles["account-sub"]}>我的投稿</h3>
        {!promoLoaded ? (
          <div className={styles["account-form"]} aria-busy aria-label="投稿加载中">
            <div
              className={styles["skeleton-block"]}
              style={{ height: 56, width: "100%" }}
            />
            <div
              className={styles["skeleton-block"]}
              style={{ height: 56, width: "100%" }}
            />
          </div>
        ) : submissions.length === 0 ? (
          <p className={styles["account-muted"]}>还没有投稿，提交第一条试试。</p>
        ) : (
          <ul className={styles["account-list"]}>
            {submissions.map((s) => (
              <li key={s.id} className={styles["account-item"]}>
                <div>
                  <a
                    href={s.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={s.videoUrl}
                  >
                    {shortenUrl(s.videoUrl)}
                  </a>
                  <p>
                    {s.createdAt
                      ? new Date(s.createdAt).toLocaleDateString("zh-CN")
                      : "—"}
                    {s.likesClaimed != null ? ` · ${s.likesClaimed} 赞` : ""}
                    {s.status === "rewarded" ? ` · +${s.monthsGranted} 个月` : ""}
                    {s.adminNote ? ` · ${s.adminNote}` : ""}
                  </p>
                </div>
                <span
                  className={`${styles["account-chip"]} ${
                    styles[STATUS_CHIP[s.status]]
                  }`}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
