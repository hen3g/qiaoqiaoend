"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Props = {
  loginHref?: string;
};

export function ForgotPasswordForm({ loginHref = "/login" }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function onSendCode() {
    setError("");
    setHint("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("请输入邮箱");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "发送失败");
        return;
      }
      setHint(data.message || "验证码已发送");
      setCooldown(Number(data.cooldownSeconds) || 60);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setHint("");

    if (newPassword !== newPasswordConfirm) {
      setError("两次输入的新密码不一致");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
          newPasswordConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "重置失败");
        return;
      }
      window.alert("重置成功，密码已重置，请使用新密码登录");
      window.location.href = loginHref;
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink lg:text-[2rem]">
        忘记密码
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        请输入已绑定的邮箱，验证后设置新密码。
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink/80">邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入已绑定邮箱"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-line/10 bg-[#f7fbfe] px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--glow)]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink/80">
            验证码
          </span>
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6 位数字"
              autoComplete="one-time-code"
              required
              className="min-w-0 flex-1 rounded-2xl border border-line/10 bg-[#f7fbfe] px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--glow)]"
            />
            <button
              type="button"
              onClick={() => void onSendCode()}
              disabled={sending || cooldown > 0}
              className="shrink-0 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3.5 text-sm font-semibold text-accent-deep transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {sending ? "发送中…" : cooldown > 0 ? `${cooldown}s` : "获取验证码"}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink/80">
            新密码
          </span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 6 位"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full rounded-2xl border border-line/10 bg-[#f7fbfe] px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--glow)]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink/80">
            确认新密码
          </span>
          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full rounded-2xl border border-line/10 bg-[#f7fbfe] px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--glow)]"
          />
        </label>

        {hint ? (
          <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm text-accent-deep">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-accent px-4 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "提交中…" : "重置密码"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        想起密码了？{" "}
        <Link
          href={loginHref}
          className="font-medium text-accent-deep hover:underline"
        >
          返回登录
        </Link>
      </p>
    </div>
  );
}
