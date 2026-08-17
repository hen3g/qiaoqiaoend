"use client";

import Link from "next/link";
import { FormEvent, useState, type ReactNode } from "react";
import styles from "@/components/company/company.module.css";

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
}: Props) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "请求失败");
        return;
      }
      setMessage(data.message || "成功");
      onSuccess?.(data);
      if (successRedirect) {
        window.location.href = successRedirect;
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className={styles["form-title"]}>{title}</h2>
      {subtitle ? <p className={styles["form-sub"]}>{subtitle}</p> : null}

      <form onSubmit={onSubmit} className={styles.form}>
        {fields.map((field) => (
          <label key={field.name} className={styles["form-label"]}>
            <span>{field.label}</span>
            <input
              name={field.name}
              type={field.type || "text"}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              required={field.required !== false}
              className={styles["form-input"]}
            />
          </label>
        ))}

        {error ? <p className={styles["form-error"]}>{error}</p> : null}
        {message ? <p className={styles["form-ok"]}>{message}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className={`${styles.btn} ${styles["btn--primary"]} ${styles["btn--block"]}`}
        >
          {busy ? "处理中…" : submitLabel}
        </button>
      </form>

      {footer ? <div className={styles["form-footer"]}>{footer}</div> : null}
    </div>
  );
}

export function AuthLinks() {
  return (
    <p>
      已有账号？{" "}
      <Link href="/login">去登录</Link>
    </p>
  );
}
