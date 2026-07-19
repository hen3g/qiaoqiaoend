"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { VipBadge } from "@/components/VipBadge";
import type { SessionUser } from "@/lib/auth";
import { ONLINE_CLIENT_URL } from "@/lib/online";

const links = [
  { href: "/#download", label: "下载客户端" },
  { href: "/courses", label: "课程下载" },
  { href: "/redeem", label: "兑换" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/" className="shrink-0" aria-label="宝贝英语首页">
        <BrandLogo size="header" priority />
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted sm:gap-5">
        <a
          href={ONLINE_CLIENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-deep"
        >
          在线体验
        </a>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname === link.href ? "font-medium text-ink" : "hover:text-ink"
            }
          >
            {link.label}
          </Link>
        ))}
        {loaded && user ? (
          <>
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 hover:text-ink"
            >
              {user.isVip ? (
                <VipBadge size={14} className="text-accent-deep" />
              ) : null}
              {user.nickname || user.username}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="hover:text-ink"
            >
              退出
            </button>
          </>
        ) : loaded ? (
          <>
            <Link href="/login" className="hover:text-ink">
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-line/10 bg-white/70 px-4 py-2 text-ink transition hover:border-accent hover:text-accent-deep"
            >
              注册
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
