"use client";

import { useEffect, useRef } from "react";
import "cap-widget";

type Props = {
  onTokenChange: (token: string | null) => void;
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

export function CapWidget({ onTokenChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = host.querySelector("cap-widget");
    if (!el) return;

    const onSolve = (event: Event) => {
      const detail = (event as CustomEvent<{ token: string }>).detail;
      onTokenChange(detail?.token ?? null);
    };
    const onReset = () => onTokenChange(null);
    const onError = () => onTokenChange(null);

    el.addEventListener("solve", onSolve);
    el.addEventListener("reset", onReset);
    el.addEventListener("error", onError);

    const delays = [0, 120, 250, 500, 1000];
    const timers = delays.map((ms) =>
      window.setTimeout(() => suppressCapAttribution(el), ms),
    );

    // 只在 credits 被重新插入时处理，避免属性改写死循环
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
      });
      observer.observe(el.shadowRoot, { childList: true, subtree: true });
    }

    return () => {
      el.removeEventListener("solve", onSolve);
      el.removeEventListener("reset", onReset);
      el.removeEventListener("error", onError);
      timers.forEach((id) => window.clearTimeout(id));
      observer?.disconnect();
    };
  }, [onTokenChange]);

  return (
    <div className="cap-wrap" ref={hostRef}>
      <cap-widget
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
    </div>
  );
}
