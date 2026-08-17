"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "@/components/company/company.module.css";

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
    <div>
      <h2 className={styles["form-title"]}>忘记密码</h2>
      <p className={styles["form-sub"]}>
        请输入已绑定的邮箱，验证后设置新密码。
      </p>

      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles["form-label"]}>
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入已绑定邮箱"
            autoComplete="email"
            required
            className={styles["form-input"]}
          />
        </label>

        <label className={styles["form-label"]}>
          <span>验证码</span>
          <div className={styles["form-row"]}>
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
              className={styles["form-input"]}
            />
            <button
              type="button"
              onClick={() => void onSendCode()}
              disabled={sending || cooldown > 0}
              className={`${styles.btn} ${styles["btn--ghost"]}`}
            >
              {sending ? "发送中…" : cooldown > 0 ? `${cooldown}s` : "获取验证码"}
            </button>
          </div>
        </label>

        <label className={styles["form-label"]}>
          <span>新密码</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 6 位"
            autoComplete="new-password"
            required
            minLength={6}
            className={styles["form-input"]}
          />
        </label>

        <label className={styles["form-label"]}>
          <span>确认新密码</span>
          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
            required
            minLength={6}
            className={styles["form-input"]}
          />
        </label>

        {hint ? <p className={styles["form-ok"]}>{hint}</p> : null}
        {error ? <p className={styles["form-error"]}>{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className={`${styles.btn} ${styles["btn--primary"]} ${styles["btn--block"]}`}
        >
          {busy ? "提交中…" : "重置密码"}
        </button>
      </form>

      <p className={styles["form-footer"]}>
        想起密码了？ <Link href={loginHref}>返回登录</Link>
      </p>
    </div>
  );
}
