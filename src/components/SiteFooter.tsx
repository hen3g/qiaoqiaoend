import { BrandLogo } from "@/components/BrandLogo";
import { ONLINE_CLIENT_URL } from "@/lib/online";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white/80 px-5 py-8 text-center text-sm text-muted sm:px-8">
      <BrandLogo size="footer" />
      <p className="mt-4">
        <a
          href={ONLINE_CLIENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-deep underline-offset-2 transition hover:underline"
        >
          在线体验
        </a>
        <span className="mx-1.5 text-line">·</span>
        需先注册账号，浏览器即可练习
      </p>
      <p className="mt-3">
        有任何问题可以联系作者
        <span className="mx-1.5 text-line">·</span>
        微信 535938559
        <span className="mx-1.5 text-line">·</span>
        <a
          href="mailto:baseheng@qq.com"
          className="text-ink underline-offset-2 transition hover:text-accent hover:underline"
        >
          baseheng@qq.com
        </a>
      </p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-ink"
        >
          辽ICP备2025052002号
        </a>
        <span className="text-line" aria-hidden>
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
      <p className="mt-3">Copyright © 2026 Baby English. All rights reserved.</p>
    </footer>
  );
}
