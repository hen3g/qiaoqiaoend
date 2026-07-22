"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { VipBadge } from "@/components/VipBadge";
import { ONLINE_CLIENT_URL } from "@/lib/online";

const links = [{ href: "/redeem", label: "兑换" }];

function AuthSlotSkeleton() {
  return (
    <div
      className="flex h-9 min-w-[7.5rem] items-center justify-end gap-2"
      aria-hidden
    >
      <span className="h-4 w-14 animate-pulse rounded bg-line/10" />
      <span className="h-9 w-16 animate-pulse rounded-lg bg-line/10" />
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-5" aria-hidden>
      <span
        className={`absolute left-0 top-0 block h-0.5 w-5 origin-center rounded-full bg-ink transition duration-200 ${
          open ? "translate-y-[7px] rotate-45" : ""
        }`}
      />
      <span
        className={`absolute left-0 top-[7px] block h-0.5 w-5 rounded-full bg-ink transition duration-200 ${
          open ? "opacity-0" : ""
        }`}
      />
      <span
        className={`absolute left-0 top-[14px] block h-0.5 w-5 origin-center rounded-full bg-ink transition duration-200 ${
          open ? "-translate-y-[7px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const navLinkClass = (href: string) =>
    pathname === href ? "font-medium text-ink" : "hover:text-ink";

  const authContent =
    status === "loading" ? (
      <AuthSlotSkeleton />
    ) : user ? (
      <div className="flex min-w-[7.5rem] items-center justify-end gap-3">
        <Link
          href="/account"
          onClick={() => setMenuOpen(false)}
          className="inline-flex max-w-[8rem] items-center gap-1.5 truncate font-medium text-ink transition hover:text-accent-deep sm:max-w-[12rem]"
        >
          {user.isVip ? (
            <VipBadge size={14} className="shrink-0 text-accent-deep" />
          ) : null}
          <span className="truncate">{user.nickname || user.username}</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            void logout();
          }}
          className="shrink-0 hover:text-ink"
        >
          退出
        </button>
      </div>
    ) : (
      <div className="flex min-w-[7.5rem] items-center justify-end gap-3">
        <Link
          href="/login"
          onClick={() => setMenuOpen(false)}
          className="hover:text-ink"
        >
          登录
        </Link>
        <Link
          href="/register"
          onClick={() => setMenuOpen(false)}
          className="rounded-lg border border-line/10 bg-white/70 px-4 py-2 text-ink transition hover:border-accent hover:text-accent-deep"
        >
          注册
        </Link>
      </div>
    );

  return (
    <header className="relative z-10 mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label="宝贝英语首页">
          <BrandLogo size="header" priority />
        </Link>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line/10 bg-white/70 text-ink transition hover:border-accent sm:hidden"
          aria-expanded={menuOpen}
          aria-controls="site-header-menu"
          aria-label={menuOpen ? "收起菜单" : "展开菜单"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon open={menuOpen} />
        </button>

        <nav className="hidden items-center justify-end gap-5 text-sm text-muted sm:flex">
          <a
            href={ONLINE_CLIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-deep"
          >
            在线版使用
          </a>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navLinkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
          {authContent}
        </nav>
      </div>

      <nav
        id="site-header-menu"
        className={`overflow-hidden transition-[max-height,opacity] duration-200 sm:hidden ${
          menuOpen
            ? "mt-4 max-h-96 opacity-100"
            : "pointer-events-none max-h-0 opacity-0"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="flex flex-col gap-1 rounded-2xl border border-line/10 bg-white/90 p-3 text-sm text-muted shadow-sm shadow-[var(--glow)]">
          <a
            href={ONLINE_CLIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="rounded-xl bg-accent px-4 py-3 text-center font-medium text-white transition hover:bg-accent-deep"
          >
            在线版使用
          </a>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`rounded-xl px-4 py-3 transition hover:bg-[#f7fbfe] ${navLinkClass(link.href)}`}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-1 border-t border-line/10 px-1 pt-3">
            {authContent}
          </div>
        </div>
      </nav>
    </header>
  );
}
