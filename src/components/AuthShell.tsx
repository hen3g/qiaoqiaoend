import { Atmosphere } from "@/components/Atmosphere";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function AuthShell({
  children,
  asideTitle,
  asideText,
}: {
  children: React.ReactNode;
  asideTitle: string;
  asideText: string;
}) {
  return (
    <div className="relative flex min-h-full flex-col overflow-x-hidden">
      <Atmosphere tall />
      <SiteHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-10 sm:px-8 sm:py-16">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/50 bg-white/70 shadow-[0_30px_80px_rgba(11,31,51,0.12)] backdrop-blur-md lg:grid-cols-[1.05fr_1fr]">
          <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#dffaf2] via-[#eaf6ff] to-[#ffe8d6] p-10 lg:flex lg:flex-col lg:justify-between">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 left-8 h-56 w-56 rounded-full bg-warm/25 blur-3xl"
            />
            <div>
              <BrandLogo size="aside" />
              <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight tracking-tight text-ink">
                {asideTitle}
              </h1>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
                {asideText}
              </p>
            </div>
            <p className="relative mt-16 text-sm text-muted">
              用键盘敲句子，学英语。
            </p>
          </aside>
          <div className="p-7 sm:p-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
