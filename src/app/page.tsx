import Link from "next/link";
import { Atmosphere } from "@/components/Atmosphere";
import { ProductDemo } from "@/components/ProductDemo";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ONLINE_CLIENT_URL } from "@/lib/online";

const features = [
  {
    key: "course",
    title: "课程",
    desc: "闯关与系列课程：看中文提示、听发音，用键盘敲出英文。从单词练到完整句子。",
    href: new URL("courses", ONLINE_CLIENT_URL).toString(),
    cta: "打开课程",
  },
  {
    key: "paper",
    title: "套卷",
    desc: "一词七练：听音辨词、释义选择、句子填空等题型，把词汇练扎实。",
    href: new URL("papers/try", ONLINE_CLIENT_URL).toString(),
    cta: "试一套卷",
  },
  {
    key: "tool",
    title: "工具 · 听写默写",
    desc: "像课堂听写一样：听读音、在纸上默写，结束后对照答案。适合巩固听力。",
    href: new URL("tools/dictation", ONLINE_CLIENT_URL).toString(),
    cta: "打开听写",
  },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col overflow-x-hidden">
      <Atmosphere tall />
      <SiteHeader />

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-2 lg:gap-12 lg:pb-28 lg:pt-16">
          <div>
            <p className="animate-rise text-sm font-medium tracking-wide text-accent-deep">
              在线版 · 课程 · 套卷 · 工具
            </p>
            <h1 className="animate-rise-delay-1 mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[2.15rem] lg:leading-snug">
              用键盘敲句子，学英语。
            </h1>
            <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              右侧演示三种用法：课程敲句、套卷听练、听写默写。点标签可切换，动画会跟着走。
            </p>
            <div className="animate-rise-delay-3 mt-8 flex flex-wrap gap-3">
              <a
                href={ONLINE_CLIENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white transition hover:bg-accent-deep"
              >
                在线版使用
              </a>
              <Link
                href="/register"
                className="rounded-xl border border-line/10 bg-white/70 px-7 py-3.5 text-base font-medium text-ink transition hover:border-accent hover:text-accent-deep"
              >
                注册账号
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">
              需先注册账号，浏览器即可开始练习，无需安装。
            </p>
          </div>

          <div className="animate-hero-reveal relative mx-auto w-full max-w-md lg:max-w-none">
            <ProductDemo />
          </div>
        </section>

        <section className="border-y border-line/10 bg-white/60">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              三种学法，一眼看懂
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              和上方演示对应：课程练表达，套卷练词汇，工具练听写。
            </p>
            <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-3">
              {features.map((item) => (
                <article key={item.key} className="feature-card">
                  <h3 className="text-xl font-medium text-ink">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{item.desc}</p>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="feature-card-link"
                  >
                    {item.cta} →
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            官网服务
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            在线版负责练习；账号与会员兑换在官网完成。
          </p>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-base">
            <Link
              href="/register"
              className="font-medium text-ink underline-offset-4 transition hover:text-accent-deep hover:underline"
            >
              注册账号
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
