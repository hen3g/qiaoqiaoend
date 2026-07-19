"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import type { SessionUser } from "@/lib/auth";

type RedeemCodeDto = {
  id: number;
  code: string;
  type: string;
  value: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string | null;
  label: string;
};

function codeStatus(c: RedeemCodeDto): { text: string; className: string } {
  if (c.usedCount >= c.maxUses) {
    return { text: "已用尽", className: "text-[#c24b1e]" };
  }
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) {
    return { text: "已过期", className: "text-muted" };
  }
  if (c.usedCount > 0) {
    return { text: "部分使用", className: "text-amber-800" };
  }
  return { text: "可用", className: "text-accent-deep" };
}

export function RedeemCodesAdmin() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [codes, setCodes] = useState<RedeemCodeDto[]>([]);
  const [created, setCreated] = useState<RedeemCodeDto[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [permanent, setPermanent] = useState(false);
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);
  const [quantity, setQuantity] = useState(1);

  const loadCodes = useCallback(async () => {
    const res = await fetch("/api/admin/redeem-codes");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setCodes(data.codes ?? []);
    setSelected(new Set());
    setError("");
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (data) => {
        const u = data.user ?? null;
        setUser(u);
        if (u?.username?.toLowerCase() === "channg") {
          await loadCodes();
        }
      })
      .finally(() => setLoaded(true));
  }, [loadCodes]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setCreated([]);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/redeem-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permanent,
          days: permanent ? undefined : days,
          maxUses,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "生成失败");
        return;
      }
      setCreated(data.codes ?? []);
      setMessage(data.message || "生成成功");
      await loadCodes();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`已复制 ${text}`);
    } catch {
      setError("复制失败，请手动选择");
    }
  }

  async function deleteCodes(ids: number[]) {
    if (ids.length === 0) return;
    const tip =
      ids.length === 1
        ? "确定删除该兑换码？相关兑换记录也会一并删除。"
        : `确定删除选中的 ${ids.length} 个兑换码？相关兑换记录也会一并删除。`;
    if (!window.confirm(tip)) return;

    setError("");
    setMessage("");
    setDeletingId(ids.length === 1 ? ids[0]! : -1);
    try {
      const res = await fetch("/api/admin/redeem-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length === 1 ? { id: ids[0] } : { ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "删除失败");
        return;
      }
      setMessage(data.message || "已删除");
      setCreated((prev) => prev.filter((c) => !ids.includes(c.id)));
      await loadCodes();
    } catch {
      setError("网络错误");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === codes.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(codes.map((c) => c.id)));
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
          兑换码后台
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
          兑换码后台
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-amber-800/80">仅本地开发可用 · 用户 channg</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          兑换码后台
        </h1>
        <p className="mt-3 text-muted">
          生成会员兑换码，查看全部记录，并可删除无效码。使用次数设为 1
          即为一次性兑换码。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <h2 className="text-lg font-medium text-ink">生成兑换码</h2>
          <fieldset className="space-y-3">
            <legend className="text-sm text-muted">会员时长</legend>
            <label className="flex items-center gap-2 text-ink">
              <input
                type="radio"
                name="vipType"
                checked={!permanent}
                onChange={() => setPermanent(false)}
              />
              按天数
            </label>
            {!permanent ? (
              <label className="block pl-6">
                <span className="mb-1.5 block text-sm text-muted">天数</span>
                <input
                  type="number"
                  min={1}
                  max={36500}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-40 rounded-2xl border border-line/10 bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
                  required={!permanent}
                />
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-ink">
              <input
                type="radio"
                name="vipType"
                checked={permanent}
                onChange={() => setPermanent(true)}
              />
              永久会员
            </label>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">使用次数</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full rounded-2xl border border-line/10 bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
                required
              />
              <span className="mt-1 block text-xs text-muted">
                1 = 一次性；同一用户仍只能兑一次
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">生成数量</span>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-2xl border border-line/10 bg-white/90 px-4 py-2.5 text-ink outline-none focus:border-accent"
                required
              />
            </label>
          </div>

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
            {busy ? "生成中…" : "生成兑换码"}
          </button>
        </form>

        {created.length > 0 ? (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-ink">
                本次生成
                <span className="ml-2 text-sm font-normal text-muted">
                  {created.length} 个
                </span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const text = created.map((c) => c.code).join("\n");
                    try {
                      await navigator.clipboard.writeText(text);
                      setMessage(`已批量复制 ${created.length} 个兑换码`);
                      setError("");
                    } catch {
                      setError("复制失败，请手动选择");
                    }
                  })();
                }}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-deep"
              >
                批量复制全部
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {created.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/10 bg-white/80 px-4 py-3"
                >
                  <div className="min-w-0">
                    <code className="break-all text-sm tracking-wide text-ink">
                      {c.code}
                    </code>
                    <p className="mt-0.5 text-sm text-muted">
                      {c.label} · 可用 {c.maxUses} 次
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(c.code)}
                    className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-ink hover:border-accent"
                  >
                    复制
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-ink">
              全部兑换码
              <span className="ml-2 text-sm font-normal text-muted">
                共 {codes.length} 个
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadCodes()}
                className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-ink hover:border-accent"
              >
                刷新
              </button>
              <button
                type="button"
                disabled={selected.size === 0 || deletingId !== null}
                onClick={() => void deleteCodes([...selected])}
                className="rounded-full border border-[#e8c4b8] bg-[#fff1eb] px-3 py-1.5 text-sm text-[#c24b1e] hover:border-[#c24b1e] disabled:opacity-50"
              >
                删除选中 ({selected.size})
              </button>
            </div>
          </div>

          {codes.length === 0 ? (
            <p className="mt-3 text-sm text-muted">暂无兑换码</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line/10 text-muted">
                    <th className="py-2 pr-2 font-medium">
                      <input
                        type="checkbox"
                        checked={
                          codes.length > 0 && selected.size === codes.length
                        }
                        onChange={toggleSelectAll}
                        aria-label="全选"
                      />
                    </th>
                    <th className="py-2 pr-3 font-medium">兑换码</th>
                    <th className="py-2 pr-3 font-medium">权益</th>
                    <th className="py-2 pr-3 font-medium">使用</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 pr-3 font-medium">创建</th>
                    <th className="py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const status = codeStatus(c);
                    return (
                      <tr key={c.id} className="border-b border-line/60">
                        <td className="py-2.5 pr-2 align-top">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={`选择 ${c.code}`}
                          />
                        </td>
                        <td className="max-w-[14rem] py-2.5 pr-3 align-top">
                          <button
                            type="button"
                            onClick={() => copyText(c.code)}
                            className="break-all text-left font-mono text-xs tracking-wide text-ink hover:text-accent-deep"
                            title="点击复制"
                          >
                            {c.code}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 align-top text-muted">
                          {c.label}
                        </td>
                        <td className="py-2.5 pr-3 align-top text-muted">
                          {c.usedCount}/{c.maxUses}
                        </td>
                        <td className={`py-2.5 pr-3 align-top ${status.className}`}>
                          {status.text}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 align-top text-muted">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleString("zh-CN")
                            : "—"}
                        </td>
                        <td className="py-2.5 align-top">
                          <button
                            type="button"
                            disabled={deletingId !== null}
                            onClick={() => void deleteCodes([c.id])}
                            className="text-[#c24b1e] hover:underline disabled:opacity-50"
                          >
                            {deletingId === c.id ? "删除中…" : "删除"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
