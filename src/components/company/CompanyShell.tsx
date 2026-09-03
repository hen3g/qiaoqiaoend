"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "./company.module.css";

const NAV = [
  { href: "#product", label: "产品" },
  { href: "#about", label: "关于" },
  { href: "#contact", label: "联系" },
] as const;

export function CompanyShell({
  children,
  home = false,
}: {
  children: React.ReactNode;
  home?: boolean;
}) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const brandHref = home ? "#top" : "/";
  const navHref = (hash: string) => (home ? hash : `/${hash}`);

  const onLogout = () => {
    closeMenu();
    void logout();
  };

  const accountLinks = user ? (
    <>
      <Link href="/account" onClick={closeMenu}>
        {user.nickname || user.username}
      </Link>
      <button type="button" onClick={onLogout}>
        退出
      </button>
    </>
  ) : null;

  return (
    <div className={styles.root}>
      <div className={styles["page-bg"]} aria-hidden="true">
        <div className={styles["page-bg__wash"]} />
        <div className={styles["page-bg__grid"]} />
        <div
          className={`${styles["page-bg__glow"]} ${styles["page-bg__glow--a"]}`}
        />
        <div
          className={`${styles["page-bg__glow"]} ${styles["page-bg__glow--b"]}`}
        />
      </div>

      <header
        className={`${styles["site-header"]}${
          scrolled ? ` ${styles["is-scrolled"]}` : ""
        }`}
      >
        <Link
          className={styles["brand-mark"]}
          href={brandHref}
          aria-label="言词科技首页"
        >
          <span className={styles["brand-mark__glyph"]} aria-hidden="true">
            言
          </span>
          <span className={styles["brand-mark__text"]}>言词科技</span>
        </Link>
        <nav className={styles["site-nav"]} aria-label="主导航">
          {NAV.map((item) => (
            <Link key={item.href} href={navHref(item.href)}>
              {item.label}
            </Link>
          ))}
          {accountLinks}
        </nav>
        <button
          className={styles["nav-toggle"]}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </header>

      <div id="mobile-nav" className={styles["mobile-nav"]} hidden={!menuOpen}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={navHref(item.href)}
            onClick={closeMenu}
          >
            {item.label}
          </Link>
        ))}
        {accountLinks}
      </div>

      <main id="top">{children}</main>

      <footer className={styles["site-footer"]}>
        <div className={styles["site-footer__top"]}>
          <div>
            <p className={styles["site-footer__brand"]}>言词科技</p>
            <p className={styles["site-footer__tag"]}>英语学习软件 · 大连</p>
          </div>
          <div className={styles["site-footer__links"]}>
            {NAV.map((item) => (
              <Link key={item.href} href={navHref(item.href)}>
                {item.label}
              </Link>
            ))}
            <Link href="/privacy">隐私政策</Link>
            <Link href="/terms">用户协议</Link>
            <Link href="/vip-agreement">会员服务协议</Link>
            <Link href="/guide">敲敲英语用户指南</Link>
            <Link href="/hamster/guide">仓鼠单词用户指南</Link>
          </div>
        </div>
        <div className={styles["site-footer__bottom"]}>
          <p>© 2026 言词科技（大连）有限公司</p>
          <p className={styles["site-footer__beian"]}>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
            >
              辽ICP备2026017437号
            </a>
            <span aria-hidden="true">|</span>
            <a
              href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=21021102001931"
              target="_blank"
              rel="noopener noreferrer"
            >
              辽公网安备21021102001931号
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
