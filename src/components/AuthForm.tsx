"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState, type ReactNode } from "react";
import { CapWidget } from "@/components/CapWidget";

type Field = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  fields: Field[];
  submitLabel: string;
  endpoint: string;
  footer?: ReactNode;
  onSuccess?: (data: Record<string, unknown>) => void;
  successRedirect?: string;
  requireCaptcha?: boolean;
};

export function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  endpoint,
  footer,
  onSuccess,
  successRedirect,
  requireCaptcha = false,
}: Props) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [capToken, setCapToken] = useState<string | null>(null);
  const [capKey, setCapKey] = useState(0);

  const onTokenChange = useCallback((token: string | null) => {
    setCapToken(token);
    if (token) setError("");
  }, []);

  const onCaptchaError = useCallback((message: string) => {
    setCapToken(null);
    setError(message);
  }, []);

  function resetCaptcha() {
    setCapToken(null);
    setCapKey((k) => k + 1);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const field of fields) {
      const raw = String(form.get(field.name) ?? "");
      body[field.name] = field.type === "password" ? raw : raw.trim();
    }

    if (
      "password" in body &&
      "passwordConfirm" in body &&
      body.password !== body.passwordConfirm
    ) {
      setError("两次输入的密码不一致");
      setBusy(false);
      return;
    }

    if (
      "newPassword" in body &&
      "newPasswordConfirm" in body &&
      body.newPassword !== body.newPasswordConfirm
    ) {
      setError("两次输入的新密码不一致");
      setBusy(false);
      return;
    }

    if (requireCaptcha) {
      if (!capToken) {
        setError("请先完成人机验证");
        setBusy(false);
        return;
      }
      body.captchaToken = capToken;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "请求失败");
        if (requireCaptcha) resetCaptcha();
        return;
      }
      setMessage(data.message || "成功");
      onSuccess?.(data);
      if (successRedirect) {
        window.location.href = successRedirect;
      }
    } catch {
      setError("网络错误，请稍后重试");
      if (requireCaptcha) resetCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink lg:text-[2rem]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {fields.map((field) => (
          <label key={field.name} className="block">
            <span className="mb-2 block text-sm font-medium text-ink/80">
              {field.label}
            </span>
            <input
              name={field.name}
              type={field.type || "text"}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              required={field.required !== false}
              className="w-full rounded-2xl border border-line bg-[#f7fbfe] px-4 py-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--glow)]"
            />
          </label>
        ))}

        {requireCaptcha ? (
          <div className="pt-1">
            <p className="mb-2 text-sm font-medium text-ink/80">人机验证</p>
            <CapWidget
              key={capKey}
              onTokenChange={onTokenChange}
              onError={onCaptchaError}
            />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-[#fff1eb] px-4 py-3 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl bg-[#e8fff8] px-4 py-3 text-sm text-accent-deep">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || (requireCaptcha && !capToken)}
          className="mt-1 w-full rounded-full bg-accent px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-[var(--glow)] transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? "处理中…" : submitLabel}
        </button>
      </form>

      {footer ? (
        <div className="mt-7 border-t border-line pt-6 text-sm text-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function AuthLinks() {
  return (
    <p>
      已有账号？{" "}
      <Link href="/login" className="font-medium text-accent-deep hover:underline">
        去登录
      </Link>
    </p>
  );
}
