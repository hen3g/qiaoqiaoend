"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MathCaptcha } from "@/components/MathCaptcha";
import { PageShell } from "@/components/PageShell";
import { VipBadge } from "@/components/VipBadge";

const plans = [
  {
    id: "month",
    name: "月度会员",
    price: "3",
    unit: "月",
    hint: "灵活续订",
    featured: false,
    payUrl: "https://pay.ldxp.cn/item/ssncfo",
  },
  {
    id: "year",
    name: "年度会员",
    price: "19.9",
    unit: "年",
    hint: "约 ¥1.66 / 月",
    featured: true,
    payUrl: "https://pay.ldxp.cn/item/gvhnxi",
  },
] as const;

export default function RedeemPage() {
  const { user, status, setUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  const onSolvedChange = useCallback((solved: boolean) => {
    setCaptchaSolved(solved);
    if (solved) setError("");
  }, []);

  function resetCaptcha() {
    setCaptchaSolved(false);
    setCaptchaKey((k) => k + 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!captchaSolved) {
      setError("请先完成验证码");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "兑换失败");
        resetCaptcha();
        return;
      }
      setMessage(data.message || "兑换成功");
      setUser(data.user ?? user);
      setCode("");
      resetCaptcha();
    } catch {
      setError("网络错误");
      resetCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        <h1 className="animate-rise font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          兑换码
        </h1>
        <p className="animate-rise-delay-1 mt-3 text-muted">
          输入兑换码延长会员时间。
        </p>

        {status === "ready" && !user ? (
          <p className="animate-rise-delay-1 mt-6 rounded-xl bg-[#fff8ef] px-3 py-2 text-sm text-muted">
            请先{" "}
            <Link href="/login" className="text-accent-deep hover:underline">
              登录
            </Link>{" "}
            后再兑换。
          </p>
        ) : null}

        {user ? (
          <p className="animate-rise-delay-1 mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <span>当前：{user.nickname || user.username}</span>
            {user.isVip ? (
              <span className="inline-flex items-center gap-1 text-accent-deep">
                <VipBadge size={13} />
                {user.isPermanentVip
                  ? "永久会员"
                  : user.vipExpiresAt
                    ? `会员至 ${new Date(user.vipExpiresAt).toLocaleDateString("zh-CN")}`
                    : "会员"}
              </span>
            ) : null}
          </p>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="animate-rise-delay-2 mt-8 space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">兑换码</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="输入兑换码"
              className="w-full rounded-2xl border border-line/10 bg-white/90 px-4 py-3 uppercase tracking-wide text-ink outline-none transition focus:border-accent"
              required
              disabled={!user}
            />
          </label>

          {user ? (
            <MathCaptcha key={captchaKey} onSolvedChange={onSolvedChange} />
          ) : null}

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
            disabled={busy || !user || !captchaSolved}
            className="w-full rounded-full bg-accent px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-[var(--glow)] transition hover:bg-accent-deep disabled:opacity-60"
          >
            {busy ? "兑换中…" : "立即兑换"}
          </button>
        </form>

        {/* 次要：获取兑换码 */}
        <section className="animate-rise-delay-3 mt-14 border-t border-line/10 pt-10">
          <h2 className="text-sm font-medium text-ink">还没有兑换码？</h2>
          <p className="mt-1 text-sm text-muted">
            支付后将收到兑换码，再回到上方填写即可。
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {plans.map((plan) => (
              <a
                key={plan.id}
                href={plan.payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative rounded-2xl border px-4 py-4 transition hover:border-accent/40 hover:bg-white ${
                  plan.featured
                    ? "border-accent/25 bg-[#e8fff8]/50"
                    : "border-line/10 bg-white/70"
                }`}
              >
                {plan.featured ? (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-warm/90 px-1.5 py-px text-[10px] font-medium text-white">
                    推荐
                  </span>
                ) : null}
                <p className="text-xs text-muted">{plan.name}</p>
                <p className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-sm text-muted">¥</span>
                  <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink">
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted">/{plan.unit}</span>
                </p>
                <p className="mt-1 text-xs text-muted">{plan.hint}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-deep group-hover:underline">
                  去购买
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="transition group-hover:translate-x-0.5"
                  >
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
