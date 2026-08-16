import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-cyan/12 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 md:grid-cols-[1.4fr_1fr] md:gap-8 md:py-12">
        <div>
          <BrandLogo size="footer" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            敲敲英语：看中文、敲英文，从单词练到句子。
          </p>
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
          <p>© 2026 言词科技（大连）有限公司</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href="/privacy"
              className="transition hover:text-ink"
            >
              隐私政策
            </a>
            <span className="text-line/20" aria-hidden>
              |
            </span>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              辽ICP备2026017437号
            </a>
            <span className="text-line/20" aria-hidden>
              |
            </span>
            <a
              href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=21021102001931"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              辽公网安备21021102001931号
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
