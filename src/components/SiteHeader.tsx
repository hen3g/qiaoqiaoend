"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { VipBadge } from "@/components/VipBadge";
import { ONLINE_CLIENT_URL } from "@/lib/online";

const links = [
  { href: "/#download", label: "下载客户端" },
  { href: "/courses", label: "课程下载" },
  { href: "/redeem", label: "兑换" },
];

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

export function SiteHeader() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();

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
        {status === "loading" ? (
          <AuthSlotSkeleton />
        ) : user ? (
          <div className="flex min-w-[7.5rem] items-center justify-end gap-3">
            <Link
              href="/account"
              className="inline-flex max-w-[8rem] items-center gap-1.5 truncate font-medium text-ink transition hover:text-accent-deep sm:max-w-[12rem]"
            >
              {user.isVip ? (
                <VipBadge size={14} className="shrink-0 text-accent-deep" />
              ) : null}
              <span className="truncate">{user.nickname || user.username}</span>
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="shrink-0 hover:text-ink"
            >
              退出
            </button>
          </div>
        ) : (
          <div className="flex min-w-[7.5rem] items-center justify-end gap-3">
            <Link href="/login" className="hover:text-ink">
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-line/10 bg-white/70 px-4 py-2 text-ink transition hover:border-accent hover:text-accent-deep"
            >
              注册
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
