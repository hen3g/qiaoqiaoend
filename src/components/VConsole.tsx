"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __vconsole?: { destroy: () => void };
  }
}

/** Mobile debug console — only loads in development. */
export function VConsole() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let destroyed = false;

    void import("vconsole").then(({ default: VConsoleCtor }) => {
      if (destroyed || window.__vconsole) return;
      window.__vconsole = new VConsoleCtor();
    });

    return () => {
      destroyed = true;
      window.__vconsole?.destroy();
      window.__vconsole = undefined;
    };
  }, []);

  return null;
}
