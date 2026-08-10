"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type PromoterCode = {
  id: number;
  code: string;
  days: number;
  label: string;
  maxUses: number;
  usedCount: number;
  createdAt: string | null;
};

type BoundUser = {
  id: number;
  username: string;
  nickname: string | null;
  redeemedAt: string | null;
};

const DAY_OPTIONS = [7, 30] as const;

export function PromoterCards() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [codes, setCodes] = useState<PromoterCode[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [codeText, setCodeText] = useState("");
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(7);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [boundUsers, setBoundUsers] = useState<BoundUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadCodes = useCallback(async () => {
    const res = await fetch("/api/promoter/codes");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setCodes(data.codes ?? []);
    setError("");
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (data) => {
        const u = data.user ?? null;
        setUser(u);
        if (u?.isPromoter) {
          await loadCodes();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadCodes]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch("/api/promoter/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeText, days }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "创建失败");
        return;
      }
      setMessage(data.message || "已创建");
      setCodeText("");
      await loadCodes();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("确定删除该推广兑换码？已兑换记录也会一并清除。")) {
      return;
    }
    setError("");
    setMessage("");
    setDeletingId(id);
    try {
      const res = await fetch(`/api/promoter/codes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "删除失败");
        return;
      }
      setMessage(data.message || "已删除");
      if (expandedId === id) {
        setExpandedId(null);
        setBoundUsers([]);
      }
      await loadCodes();
    } catch {
      setError("网络错误");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleUsers(codeId: number) {
    if (expandedId === codeId) {
      setExpandedId(null);
      setBoundUsers([]);
      return;
    }
    setExpandedId(codeId);
    setUsersLoading(true);
    setBoundUsers([]);
    try {
      const res = await fetch(`/api/promoter/codes/${codeId}/users`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载绑定用户失败");
        setExpandedId(null);
        return;
      }
      setBoundUsers(data.users ?? []);
    } catch {
      setError("网络错误");
      setExpandedId(null);
    } finally {
      setUsersLoading(false);
    }
  }

  async function copyCode(item: PromoterCode) {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("复制失败");
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
          推广卡片
        </h1>
        <p className="mt-4 text-muted">
          请先{" "}
          <Link href="/login" className="text-accent-deep hover:underline">
            登录
          </Link>
          。
        </p>
      </PageShell>
    );
  }

  if (!user.isPromoter) {
    return (
      <PageShell>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          推广卡片
        </h1>
        <p className="mt-4 text-muted">当前账号不是推广者，无法使用此功能。</p>
      </PageShell>
    );
  }

  const canCreate = codes.length < 3;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted">
          <Link href="/account" className="text-accent-deep hover:underline">
            返回账户
          </Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          推广卡片
        </h1>
        <p className="mt-3 text-muted">
          最多创建 3 个兑换码，可选 7 天或 30 天会员。用户兑换后将绑定为你的推广用户。
        </p>

        <form
          onSubmit={(e) => void onCreate(e)}
          className="mt-8 space-y-4 rounded-2xl border border-line/10 bg-white/70 p-5"
        >
          <h2 className="text-base font-medium text-ink">创建兑换码</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">
              兑换码文本（至少 4 位，仅英文或数字）
            </span>
            <input
              value={codeText}
              onChange={(e) => setCodeText(e.target.value)}
              placeholder="例如 MYCODE01"
              maxLength={64}
              disabled={!canCreate || busy}
              className="w-full rounded-2xl border border-line/10 bg-white px-4 py-2.5 font-mono uppercase text-ink outline-none focus:border-accent disabled:opacity-60"
            />
          </label>
          <fieldset className="block">
            <legend className="mb-1.5 text-sm text-muted">会员天数</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!canCreate || busy}
                  onClick={() => setDays(d)}
                  className={`rounded-full px-4 py-2 text-sm transition disabled:opacity-60 ${
                    days === d
                      ? "bg-accent text-white"
                      : "border border-line/15 text-ink hover:border-accent"
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-muted">默认可使用 999999 次</p>
          {!canCreate ? (
            <p className="text-sm text-[#c24b1e]">已达 3 个上限，请先删除后再创建。</p>
          ) : null}
          <button
            type="submit"
            disabled={!canCreate || busy || !codeText.trim()}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-deep disabled:opacity-60"
          >
            {busy ? "创建中…" : "创建兑换码"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-xl bg-[#eaf2ff] px-3 py-2 text-sm text-accent-deep">
            {message}
          </p>
        ) : null}

        <div className="mt-8">
          <h2 className="text-base font-medium text-ink">
            我的兑换码（{codes.length}/3）
          </h2>
          {codes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">暂无推广兑换码</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {codes.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-line/10 bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-medium tracking-wide text-ink">
                        {item.code}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {item.label} · 已用 {item.usedCount}/{item.maxUses}
                        {item.createdAt
                          ? ` · ${new Date(item.createdAt).toLocaleString("zh-CN")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyCode(item)}
                        className="rounded-full border border-line/15 px-3 py-1.5 text-xs text-ink hover:border-accent"
                      >
                        {copiedId === item.id ? "已复制" : "复制"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleUsers(item.id)}
                        className="rounded-full border border-line/15 px-3 py-1.5 text-xs text-ink hover:border-accent"
                      >
                        {expandedId === item.id ? "收起用户" : "绑定用户"}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => void onDelete(item.id)}
                        className="rounded-full border border-[#f0c8b8] px-3 py-1.5 text-xs text-[#c24b1e] hover:bg-[#fff1eb] disabled:opacity-60"
                      >
                        {deletingId === item.id ? "删除中…" : "删除"}
                      </button>
                    </div>
                  </div>

                  {expandedId === item.id ? (
                    <div className="mt-4 border-t border-line/10 pt-3">
                      {usersLoading ? (
                        <p className="text-sm text-muted">加载中…</p>
                      ) : boundUsers.length === 0 ? (
                        <p className="text-sm text-muted">暂无用户兑换此码</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="text-muted">
                                <th className="py-1.5 pr-3 font-medium">ID</th>
                                <th className="py-1.5 pr-3 font-medium">用户名</th>
                                <th className="py-1.5 pr-3 font-medium">昵称</th>
                                <th className="py-1.5 font-medium">兑换时间</th>
                              </tr>
                            </thead>
                            <tbody>
                              {boundUsers.map((u) => (
                                <tr key={u.id} className="border-t border-line/60">
                                  <td className="py-2 pr-3 text-muted">{u.id}</td>
                                  <td className="py-2 pr-3 text-ink">{u.username}</td>
                                  <td className="py-2 pr-3 text-muted">
                                    {u.nickname || "—"}
                                  </td>
                                  <td className="py-2 text-muted">
                                    {u.redeemedAt
                                      ? new Date(u.redeemedAt).toLocaleString(
                                          "zh-CN",
                                        )
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
