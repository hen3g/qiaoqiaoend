"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { VipBadge } from "@/components/VipBadge";

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
    ) : null;

  const showAuthNav = status === "loading" || Boolean(user);

  return (
    <header className="sticky top-0 z-20 border-b border-cyan/15 bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-3.5 sm:px-8 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="shrink-0" aria-label="言词科技首页">
            <BrandLogo size="header" priority />
          </Link>

          {showAuthNav ? (
            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cyan/20 bg-white/70 text-ink transition hover:border-accent"
                aria-expanded={menuOpen}
                aria-controls="site-header-menu"
                aria-label={menuOpen ? "收起菜单" : "展开菜单"}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MenuIcon open={menuOpen} />
              </button>
            </div>
          ) : null}

          {showAuthNav ? (
            <nav className="hidden items-center justify-end gap-5 text-sm text-muted sm:flex">
              {authContent}
            </nav>
          ) : null}
        </div>

        {showAuthNav ? (
          <nav
            id="site-header-menu"
            className={`overflow-hidden transition-[max-height,opacity] duration-200 sm:hidden ${
              menuOpen
                ? "mt-3 max-h-96 opacity-100"
                : "pointer-events-none max-h-0 opacity-0"
            }`}
            aria-hidden={!menuOpen}
          >
            <div className="flex flex-col gap-1 rounded-xl border border-cyan/15 bg-white/90 p-2.5 text-sm text-muted shadow-[0_12px_40px_rgba(11,21,36,0.08)]">
              <div className="px-1 py-1">{authContent}</div>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
