"use client";

import { useEffect, useRef, useState } from "react";
import { ensureCapClientAssets } from "@/lib/cap-client-setup";

type Props = {
  onTokenChange: (token: string | null) => void;
  onError?: (message: string) => void;
};

function suppressCapAttribution(widget: Element) {
  const root = widget.shadowRoot;
  if (!root) return;

  if (!root.querySelector("style[data-hide-cap-credits]")) {
    const style = document.createElement("style");
    style.setAttribute("data-hide-cap-credits", "true");
    style.textContent = `
      a.credits,
      .credits {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        font-size: 0 !important;
      }
      .cap-troubleshoot-link {
        display: none !important;
      }
    `;
    root.appendChild(style);
  }

  const credits = root.querySelector("a.credits, .credits") as HTMLElement | null;
  if (!credits) return;

  // Cap 会在约 100ms 用 inline !important 强制显示，这里覆盖回去
  credits.removeAttribute("href");
  credits.removeAttribute("title");
  credits.setAttribute("aria-hidden", "true");
  credits.setAttribute("tabindex", "-1");
  credits.textContent = "";
  credits.style.cssText = [
    "display: none !important",
    "visibility: hidden !important",
    "opacity: 0 !important",
    "pointer-events: none !important",
    "width: 0 !important",
    "height: 0 !important",
    "min-width: 0 !important",
    "min-height: 0 !important",
    "padding: 0 !important",
    "margin: 0 !important",
    "overflow: hidden !important",
    "font-size: 0 !important",
    "position: absolute !important",
    "inset: auto !important",
  ].join(";");
}

function widgetUiReady(widget: Element | null) {
  return Boolean(widget?.shadowRoot?.querySelector(".captcha"));
}

export function CapWidget({ onTokenChange, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mountId, setMountId] = useState(0);
  const [scriptReady, setScriptReady] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("正在加载验证组件…");

  // Client-only: avoid SSR empty <cap-widget> that often fails to upgrade on iOS Safari.
  useEffect(() => {
    let cancelled = false;
    setScriptReady(false);
    setUiReady(false);
    setFailed(false);
    setStatus("正在加载验证组件…");
    onTokenChange(null);

    ensureCapClientAssets();

    (async () => {
      try {
        await import("cap-widget");
        await customElements.whenDefined("cap-widget");
        if (!cancelled) setScriptReady(true);
      } catch (err) {
        console.warn("[cap-widget] failed to load", err);
        if (cancelled) return;
        setFailed(true);
        setStatus("验证组件加载失败，请重试");
        onError?.("验证组件加载失败，请重试");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mountId, onTokenChange, onError]);

  useEffect(() => {
    if (!scriptReady || failed) return;

    const host = hostRef.current;
    if (!host) return;
    const el = host.querySelector("cap-widget");
    if (!el) return;

    const onSolve = (event: Event) => {
      const detail = (event as CustomEvent<{ token: string }>).detail;
      onTokenChange(detail?.token ?? null);
    };
    const onReset = () => onTokenChange(null);
    const onCapError = (event: Event) => {
      onTokenChange(null);
      const detail = (event as CustomEvent<{ message?: string; code?: string }>)
        .detail;
      const message =
        detail?.message?.trim() ||
        (detail?.code ? `验证失败（${detail.code}）` : "验证失败，请重试");
      onError?.(message);
      console.warn("[cap-widget]", detail?.code ?? "error", message);
    };

    el.addEventListener("solve", onSolve);
    el.addEventListener("reset", onReset);
    el.addEventListener("error", onCapError);

    const markReady = () => {
      if (!widgetUiReady(el)) return false;
      setUiReady(true);
      suppressCapAttribution(el);
      return true;
    };

    markReady();
    const poll = window.setInterval(() => {
      if (markReady()) window.clearInterval(poll);
    }, 50);

    const delays = [0, 50, 120, 250, 500, 1000];
    const timers = delays.map((ms) =>
      window.setTimeout(() => suppressCapAttribution(el), ms),
    );

    const failTimer = window.setTimeout(() => {
      if (widgetUiReady(el)) return;
      console.warn("[cap-widget] shadow UI missing after mount");
      setFailed(true);
      setUiReady(false);
      setStatus("验证组件未显示，请重试");
      onError?.("验证组件未显示，请重试");
    }, 2000);

    let observer: MutationObserver | null = null;
    if (el.shadowRoot) {
      observer = new MutationObserver((mutations) => {
        const added = mutations.some((m) =>
          Array.from(m.addedNodes).some(
            (n) =>
              n instanceof HTMLElement &&
              (n.classList.contains("credits") ||
                n.querySelector?.(".credits")),
          ),
        );
        if (added) suppressCapAttribution(el);
        markReady();
      });
      observer.observe(el.shadowRoot, { childList: true, subtree: true });
    }

    return () => {
      el.removeEventListener("solve", onSolve);
      el.removeEventListener("reset", onReset);
      el.removeEventListener("error", onCapError);
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(poll);
      window.clearTimeout(failTimer);
      observer?.disconnect();
    };
  }, [scriptReady, failed, mountId, onTokenChange, onError]);

  function retry() {
    setMountId((n) => n + 1);
  }

  const showFallback = !uiReady || failed;

  return (
    <div className="cap-wrap" ref={hostRef}>
      {showFallback ? (
        <div
          className={`cap-fallback${failed ? " cap-fallback-error" : ""}`}
          role={failed ? "alert" : undefined}
          aria-live="polite"
        >
          <span>{status}</span>
          {failed ? (
            <button type="button" className="cap-retry" onClick={retry}>
              重试
            </button>
          ) : null}
        </div>
      ) : null}

      {scriptReady && !failed ? (
        <cap-widget
          key={mountId}
          className={uiReady ? undefined : "cap-widget-pending"}
          data-cap-api-endpoint="/api/cap/"
          data-cap-i18n-initial-state="我不是机器人"
          data-cap-i18n-verifying-label="验证中…"
          data-cap-i18n-solved-label="验证通过"
          data-cap-i18n-error-label="验证失败，请重试"
          data-cap-i18n-verify-aria-label="点击完成人机验证"
          data-cap-i18n-verifying-aria-label="正在验证，请稍候"
          data-cap-i18n-verified-aria-label="已通过验证"
          data-cap-i18n-error-aria-label="验证出错，请重试"
          data-cap-i18n-required-label="请先完成人机验证"
        />
      ) : null}
    </div>
  );
}
