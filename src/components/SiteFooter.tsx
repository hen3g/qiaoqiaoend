import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { ONLINE_CLIENT_URL } from "@/lib/online";

const navLinks = [
  { href: "/#download", label: "下载客户端" },
  { href: "/courses", label: "课程下载" },
  { href: "/redeem", label: "兑换" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-line/10 bg-white/80">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8 md:py-12">
        <div>
          <BrandLogo size="footer" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            看中文、敲英文，从单词练到句子，帮助孩子把英语真正用起来。
          </p>
          <a
            href={ONLINE_CLIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-deep"
          >
            在线版使用
          </a>
        </div>

        <div>
          <h2 className="text-sm font-medium text-ink">快速入口</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-accent-deep"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={ONLINE_CLIENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-accent-deep"
              >
                在线版使用
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-medium text-ink">联系作者</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>
              <span className="text-ink/55">微信</span>
              <span className="ml-2 text-ink">535938559</span>
            </li>
            <li>
              <span className="text-ink/55">邮箱</span>
              <a
                href="mailto:baseheng@qq.com"
                className="ml-2 text-ink underline-offset-2 transition hover:text-accent-deep hover:underline"
              >
                baseheng@qq.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Copyright © 2026 Baby English. All rights reserved.</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              辽ICP备2025052002号
            </a>
            <span className="text-line/20" aria-hidden>
              |
            </span>
            <a
              href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=21100202000247"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              辽公网安备21100202000247号
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
