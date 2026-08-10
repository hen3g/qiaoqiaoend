import Link from "next/link";
import { Atmosphere } from "@/components/Atmosphere";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col overflow-x-hidden">
      <Atmosphere tall />
      <SiteHeader />

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-28 sm:pt-24">
          <div className="animate-rise">
            <BrandLogo size="hero" priority />
          </div>
          <h1 className="animate-rise-delay-1 mt-8 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            敲敲英语
          </h1>
          <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            用键盘敲句子，学英语。账号服务与后台管理入口。
          </p>
          <div className="animate-rise-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white shadow-[0_0_0_1px_rgba(43,109,232,0.3),0_10px_30px_rgba(43,109,232,0.28)] transition hover:bg-accent-deep"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-cyan/20 bg-white/70 px-7 py-3.5 text-base font-medium text-ink backdrop-blur-sm transition hover:border-accent hover:text-accent-deep"
            >
              注册账号
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
