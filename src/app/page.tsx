import Image from "next/image";
import Link from "next/link";
import { Atmosphere } from "@/components/Atmosphere";
import { BrandLogo } from "@/components/BrandLogo";
import { HomeDownload } from "@/components/HomeDownload";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const steps = [
  {
    n: "01",
    title: "选一门课程",
    desc: "每门课围绕一组单词，从简单到完整句子逐步练习。",
  },
  {
    n: "02",
    title: "看中文，敲英文",
    desc: "上方是中文提示和音标，用键盘把对应英文敲出来。",
  },
  {
    n: "03",
    title: "从单词练到句子",
    desc: "先练单词和短语，再挑战完整句子，一步步会用。",
  },
];

const capabilities = [
  {
    title: "键盘敲句练习",
    desc: "看中文与音标，直接输入英文。连击、正确率与进度即时反馈，沉浸模式专注练习。",
  },
  {
    title: "主题课程库",
    desc: "从启蒙入门到考试备考、职场场景，按阶段与场景整理，官网课程包可免费下载。",
  },
  {
    title: "自制与导入",
    desc: "用 AI 按主题生成课程，或导入自制 JSON / zip 课程包，按自己的词表练。",
  },
  {
    title: "学习数据",
    desc: "练习时长、正确率、连击与连续学习日本地记录，登录后可同步查看统计。",
  },
];

const audiences = [
  { label: "启蒙入门", hint: "颜色、家人、动物" },
  { label: "校园进阶", hint: "小学到高中词汇" },
  { label: "生活场景", hint: "出行、购物、就医" },
  { label: "考试职场", hint: "四六级、雅思、商务" },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col overflow-x-hidden">
      <Atmosphere tall />
      <SiteHeader />

      <main className="relative z-10">
        {/* Hero: left copy + right product image */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-2 lg:gap-12 lg:pb-28 lg:pt-16">
          <div>
            <h1 className="animate-rise">
              <BrandLogo size="hero" priority />
            </h1>
            <p className="animate-rise-delay-1 mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[2.15rem] lg:leading-snug">
              用键盘敲句子，学英语。
            </p>
            <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              看中文提示，敲出对应英文。从单词到短语再到句子，在电脑上主动练会用。
            </p>
            <div className="animate-rise-delay-3 mt-8 flex flex-wrap gap-3">
              <a
                href="#download"
                className="rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white transition hover:bg-accent-deep"
              >
                下载客户端
              </a>
              <Link
                href="/register"
                className="rounded-xl border border-line bg-white/70 px-7 py-3.5 text-base font-medium text-ink transition hover:border-accent hover:text-accent-deep"
              >
                免费注册
              </Link>
            </div>
          </div>

          <div className="animate-hero-reveal relative mx-auto w-full max-w-md lg:max-w-none">
            <Image
              src="/mocklify.png"
              alt="宝贝英语客户端：看中文句子，用键盘敲出英文"
              width={1430}
              height={938}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            三步开始练习
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            打开客户端即可开练，不需要先注册。
          </p>
          <ol className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
            {steps.map((step) => (
              <li key={step.n}>
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-widest text-accent">
                  {step.n}
                </p>
                <h3 className="mt-3 text-xl font-medium text-ink">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Product capabilities */}
        <section className="border-y border-line bg-white/60">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              软件能做什么
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              宝贝英语是桌面端练习工具：主动敲句，而不是被动刷课。
            </p>
            <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2">
              {capabilities.map((item) => (
                <article key={item.title} className="border-t border-line pt-6">
                  <h3 className="text-xl font-medium text-ink">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Audience / curriculum breadth */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            从启蒙到职场
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            课程按阶段与场景整理，官网开放下载，导入客户端即可练。
          </p>
          <ul className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {audiences.map((a) => (
              <li key={a.label}>
                <p className="text-lg font-medium text-ink">{a.label}</p>
                <p className="mt-1 text-sm text-muted">{a.hint}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/courses"
            className="mt-10 inline-flex text-sm font-medium text-accent-deep transition hover:underline"
          >
            浏览课程下载 →
          </Link>
        </section>

        <HomeDownload />

        {/* Site services CTA */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            官网服务
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            客户端负责练习；账号、课程包与会员兑换在官网完成。
          </p>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-base">
            <Link
              href="/register"
              className="font-medium text-ink underline-offset-4 transition hover:text-accent-deep hover:underline"
            >
              注册账号
            </Link>
            <Link
              href="/courses"
              className="font-medium text-ink underline-offset-4 transition hover:text-accent-deep hover:underline"
            >
              课程下载
            </Link>
            <Link
              href="/redeem"
              className="font-medium text-ink underline-offset-4 transition hover:text-accent-deep hover:underline"
            >
              兑换会员
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
