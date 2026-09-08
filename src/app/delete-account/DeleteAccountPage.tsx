"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./delete-account.module.css";

const LANGS = ["en", "zh", "ja", "ko"] as const;
type Lang = (typeof LANGS)[number];

const COPY = {
  en: {
    title: "Delete account",
    subtitle:
      "This cannot be undone. Make sure you no longer need this learning record.",
    warnTitle: "This will also remove",
    items: [
      "Profile, avatar, and linked email",
      "Membership time and diamond balance",
      "Learning progress on this device is kept",
    ],
    account: "Account",
    accountPh: "Username or email",
    password: "Password",
    passwordPh: "Enter your password to confirm it's you",
    submit: "Permanently delete account",
    busy: "Deleting…",
    confirmTitle: "Delete this account?",
    confirmBody:
      "This cannot be undone. Your profile, membership, and diamonds will be deleted.",
    cancel: "Cancel",
    confirm: "Delete account",
    doneTitle: "Account deleted",
    doneBody: "Related learning data has been removed from the server.",
    invalid: "Account or password is incorrect",
    rate: "Too many attempts. Try again later.",
    failed: "Couldn't delete the account. Try again later.",
    network: "Network error. Try again later.",
    empty: "Enter your account and password",
  },
  zh: {
    title: "删除账号",
    subtitle: "删除后无法恢复，请先确认你不再需要这份学习记录。",
    warnTitle: "将同时删除",
    items: [
      "账号资料、头像与绑定邮箱",
      "会员时长与钻石余额",
      "本机学习进度不会随账号删除",
    ],
    account: "账号",
    accountPh: "用户名或邮箱",
    password: "密码",
    passwordPh: "输入密码以确认是你本人",
    submit: "永久删除账号",
    busy: "正在删除…",
    confirmTitle: "确认删除账号？",
    confirmBody: "此操作不可恢复。账号资料、会员与钻石都将删除。",
    cancel: "取消",
    confirm: "删除账号",
    doneTitle: "账号已删除",
    doneBody: "相关学习数据已从服务器移除。",
    invalid: "账号或密码不正确",
    rate: "尝试次数过多，请稍后再试",
    failed: "删除失败，请稍后重试",
    network: "网络错误，请稍后重试",
    empty: "请输入账号和密码",
  },
  ja: {
    title: "アカウント削除",
    subtitle:
      "削除すると元に戻せません。この学習記録が不要であることを確認してください。",
    warnTitle: "あわせて削除されるもの",
    items: [
      "プロフィール、アイコン、連携メール",
      "会員期間とダイヤ残高",
      "この端末の学習進捗は削除されません",
    ],
    account: "アカウント",
    accountPh: "ユーザー名またはメール",
    password: "パスワード",
    passwordPh: "本人確認のためパスワードを入力",
    submit: "アカウントを完全に削除",
    busy: "削除しています…",
    confirmTitle: "アカウントを削除しますか？",
    confirmBody:
      "この操作は元に戻せません。アカウント情報、会員、ダイヤが削除されます。",
    cancel: "キャンセル",
    confirm: "削除する",
    doneTitle: "アカウントを削除しました",
    doneBody: "関連する学習データはサーバーから削除されました。",
    invalid: "アカウントまたはパスワードが正しくありません",
    rate: "試行回数が多すぎます。しばらくしてから再試行してください。",
    failed: "削除に失敗しました。しばらくしてから再試行してください。",
    network: "ネットワークエラーです。しばらくしてから再試行してください。",
    empty: "アカウントとパスワードを入力してください",
  },
  ko: {
    title: "계정 삭제",
    subtitle:
      "삭제하면 되돌릴 수 없습니다. 이 학습 기록이 더 이상 필요 없는지 확인해 주세요.",
    warnTitle: "함께 삭제됩니다",
    items: [
      "프로필, 아바타, 연결된 이메일",
      "회원 기간과 다이아 잔액",
      "이 기기의 학습 진행 상황은 삭제되지 않습니다",
    ],
    account: "계정",
    accountPh: "사용자 이름 또는 이메일",
    password: "비밀번호",
    passwordPh: "본인 확인을 위해 비밀번호를 입력하세요",
    submit: "계정을 영구 삭제",
    busy: "삭제 중…",
    confirmTitle: "계정을 삭제할까요?",
    confirmBody:
      "이 작업은 되돌릴 수 없습니다. 계정 정보, 회원, 다이아가 삭제됩니다.",
    cancel: "취소",
    confirm: "계정 삭제",
    doneTitle: "계정이 삭제되었습니다",
    doneBody: "관련 학습 데이터가 서버에서 삭제되었습니다.",
    invalid: "계정 또는 비밀번호가 올바르지 않습니다",
    rate: "시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    failed: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    network: "네트워크 오류입니다. 잠시 후 다시 시도해 주세요.",
    empty: "계정과 비밀번호를 입력해 주세요",
  },
} as const;

const HTML_LANG: Record<Lang, string> = {
  en: "en",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
};

function normalizeLang(raw: string | null | undefined): Lang | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase().replace("_", "-");
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("ko")) return "ko";
  if (value.startsWith("en")) return "en";
  return null;
}

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  const fromQuery = normalizeLang(
    new URLSearchParams(window.location.search).get("lang"),
  );
  if (fromQuery) return fromQuery;
  const candidates = [
    navigator.language,
    ...(navigator.languages ?? []),
  ];
  for (const item of candidates) {
    const lang = normalizeLang(item);
    if (lang) return lang;
  }
  return "en";
}

export function DeleteAccountPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const copy = COPY[lang];
  const canSubmit = account.trim().length > 0 && password.length > 0 && !busy;

  useEffect(() => {
    setLang(detectLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
    const url = new URL(window.location.href);
    if (url.searchParams.get("lang") !== lang) {
      url.searchParams.set("lang", lang);
      window.history.replaceState(null, "", url);
    }
  }, [lang]);

  const labels = useMemo(
    () =>
      [
        ["en", "English"],
        ["zh", "中文"],
        ["ja", "日本語"],
        ["ko", "한국어"],
      ] as const,
    [],
  );

  async function runDelete() {
    if (!canSubmit) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/delete-account/by-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: account.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
      };
      if (!res.ok || !data.ok) {
        if (data.code === "invalid_credentials") setError(copy.invalid);
        else if (data.code === "rate_limited") setError(copy.rate);
        else setError(copy.failed);
        setConfirming(false);
        return;
      }
      setDone(true);
      setConfirming(false);
      setPassword("");
    } catch {
      setError(copy.network);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account.trim() || !password) {
      setError(copy.empty);
      return;
    }
    setError("");
    setConfirming(true);
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.langs} role="group" aria-label="Language">
          {labels.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={lang === id ? styles.langActive : styles.lang}
              onClick={() => setLang(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {done ? (
          <>
            <h1 className={styles.title}>{copy.doneTitle}</h1>
            <p className={styles.sub}>{copy.doneBody}</p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.sub}>{copy.subtitle}</p>
            <section className={styles.warn}>
              <p className={styles.warnTitle}>{copy.warnTitle}</p>
              <ul>
                {copy.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.label}>
                <span>{copy.account}</span>
                <input
                  className={styles.input}
                  value={account}
                  onChange={(event) => {
                    setAccount(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="username"
                  placeholder={copy.accountPh}
                  disabled={busy}
                />
              </label>
              <label className={styles.label}>
                <span>{copy.password}</span>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
                  placeholder={copy.passwordPh}
                  disabled={busy}
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                className={styles.deleteBtn}
                type="submit"
                disabled={!canSubmit}
              >
                {busy ? copy.busy : copy.submit}
              </button>
            </form>
          </>
        )}
      </div>

      {confirming ? (
        <div className={styles.mask} role="presentation">
          <div className={styles.dialog} role="dialog" aria-modal="true">
            <h2>{copy.confirmTitle}</h2>
            <p>{copy.confirmBody}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => void runDelete()}
                disabled={busy}
              >
                {busy ? copy.busy : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
