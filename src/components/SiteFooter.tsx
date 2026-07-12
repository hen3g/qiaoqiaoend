import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white/80 px-5 py-8 text-center text-sm text-muted sm:px-8">
      <BrandLogo size="footer" />
      <p className="mt-4">
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
      <p className="mt-3">Copyright © 2026 Baby English. All rights reserved.</p>
    </footer>
  );
}
