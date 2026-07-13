"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";
import type { NotificationType } from "@/lib/notifications";

type NotificationDto = {
  id: number;
  type: NotificationType;
  version: string | null;
  title: string;
  summary: string;
  imageUrl: string | null;
  linkUrl: string;
  createdAt: string | null;
};

const TYPE_LABEL: Record<NotificationType, string> = {
  update: "更新通知",
  message: "消息通知",
};

export function NotificationsAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [type, setType] = useState<NotificationType>("update");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/admin/notifications");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setNotifications(data.notifications ?? []);
    setError("");
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (data) => {
        const u = data.user ?? null;
        setUser(u);
        if (u?.username?.toLowerCase() === "channg") {
          await loadNotifications();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadNotifications]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          version: type === "update" ? version : null,
          title,
          summary,
          imageUrl,
          linkUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "发布失败");
        return;
      }
      setMessage(data.message || "发布成功");
      setVersion("");
      setTitle("");
      setSummary("");
      setImageUrl("");
      setLinkUrl("");
      await loadNotifications();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("确定删除该通知？")) return;
    setError("");
    setMessage("");
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "删除失败");
        return;
      }
      setMessage(data.message || "已删除");
      await loadNotifications();
    } catch {
      setError("网络错误");
    } finally {
      setDeletingId(null);
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
          通知设置
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
          通知设置
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-amber-800/80">仅本地开发可用 · 用户 channg</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          通知设置
        </h1>
        <p className="mt-3 text-muted">
          发布更新通知或消息通知。公开接口{" "}
          <code className="text-sm text-ink">GET /api/notifications</code>{" "}
          会返回各类型最新一条，最多两条。调用量与日活见{" "}
          <Link
            href="/admin/notification-stats"
            className="text-accent-deep hover:underline"
          >
            通知接口统计
          </Link>
          。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <h2 className="text-lg font-medium text-ink">发布通知</h2>

          <fieldset className="space-y-3">
            <legend className="text-sm text-muted">通知类型</legend>
            <label className="flex items-center gap-2 text-ink">
              <input
                type="radio"
                name="notifType"
                checked={type === "update"}
                onChange={() => setType("update")}
              />
              更新通知
            </label>
            <label className="flex items-center gap-2 text-ink">
              <input
                type="radio"
                name="notifType"
                checked={type === "message"}
                onChange={() => setType("message")}
              />
              消息通知
            </label>
          </fieldset>

          {type === "update" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">版本号</span>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="例如 1.2.0"
                maxLength={64}
                className="w-full rounded-2xl border border-line bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">标题</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-2xl border border-line bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">简介</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-2xl border border-line bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">
              图片链接（可选）
            </span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://"
              maxLength={500}
              className="w-full rounded-2xl border border-line bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">跳转链接</span>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://"
              maxLength={500}
              className="w-full rounded-2xl border border-line bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl bg-[#e8fff8] px-3 py-2 text-sm text-accent-deep">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-accent px-6 py-3 text-base font-medium text-white shadow-lg shadow-[var(--glow)] transition hover:bg-accent-deep disabled:opacity-60"
          >
            {busy ? "发布中…" : "发布通知"}
          </button>
        </form>

        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-ink">
              全部通知
              <span className="ml-2 text-sm font-normal text-muted">
                共 {notifications.length} 条
              </span>
            </h2>
            <button
              type="button"
              onClick={() => void loadNotifications()}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
            >
              刷新
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-muted">暂无通知</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-white/80 p-4 sm:flex-row sm:items-start"
                >
                  {n.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={n.imageUrl}
                      alt=""
                      className="h-20 w-28 shrink-0 rounded-xl object-cover bg-[#f3f0ea]"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">
                      {TYPE_LABEL[n.type]}
                      {n.version ? ` · ${n.version}` : ""}
                      {n.createdAt
                        ? ` · ${new Date(n.createdAt).toLocaleString("zh-CN")}`
                        : ""}
                    </p>
                    <p className="mt-1 font-medium text-ink">{n.title}</p>
                    <p className="mt-1 text-sm text-muted">{n.summary}</p>
                    <a
                      href={n.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block break-all text-sm text-accent-deep hover:underline"
                    >
                      {n.linkUrl}
                    </a>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => void onDelete(n.id)}
                    className="shrink-0 self-start text-sm text-[#c24b1e] hover:underline disabled:opacity-50"
                  >
                    {deletingId === n.id ? "删除中…" : "删除"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
