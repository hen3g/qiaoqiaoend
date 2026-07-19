"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CategoryIcon, DifficultyBadge } from "@/components/CategoryIcons";
import { PageShell } from "@/components/PageShell";
import { VipBadge } from "@/components/VipBadge";
import type { SessionUser } from "@/lib/auth";

type Course = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  difficulty: number | null;
  wordCount: number;
  durationMinutes: number;
  isFree: boolean;
  requiresVip: boolean;
  canDownload: boolean;
  categoryId: number | null;
  categorySlug: string | null;
};

type Category = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  accentColor: string | null;
  tintColor: string | null;
  courseCount: number;
  courses: Course[];
};

function displayTitle(title: string) {
  const i = title.indexOf("·");
  if (i === -1) return title;
  return title.slice(i + 1).trim() || title;
}

export default function CoursesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [activeSlug, setActiveSlug] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "加载失败");
          return;
        }
        setCategories(data.categories || []);
        setTotal(data.total || 0);
        setUser(data.user ?? null);
      })
      .catch(() => setError("网络错误"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((cat) => activeSlug === "all" || cat.slug === activeSlug)
      .map((cat) => {
        if (!q) return cat;
        const courses = cat.courses.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            (c.description || "").toLowerCase().includes(q),
        );
        return { ...cat, courses, courseCount: courses.length };
      })
      .filter((cat) => cat.courseCount > 0);
  }, [categories, activeSlug, query]);

  async function downloadCourse(course: Course) {
    setBusyId(course.id);
    try {
      const res = await fetch(`/api/courses/${course.id}/download`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error || "下载失败");
        return;
      }
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.filename || `${course.slug}.zip`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setError("");
    } catch {
      setError("下载失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageShell>
      <header className="animate-rise">
        <p className="text-sm font-medium tracking-wide text-accent-deep">
          课程图书馆 · {total || "…"} 门
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
          按主题选课
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          从启蒙到职场，按阶段与场景整理。所有课程均可直接下载，无需登录或会员。
        </p>
        <p className="mt-4 max-w-2xl rounded-xl border border-warm/30 bg-warm/10 px-4 py-3 text-sm leading-relaxed text-ink">
          下载的课程包仅支持在本地客户端导入使用。在线版只能自制课程，无法导入官网课程包。
        </p>
        <a
          href="https://pan.quark.cn/s/728d2804d9d3"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex max-w-xl cursor-pointer items-center justify-between gap-4 rounded-2xl border border-ink/15 bg-white/90 px-5 py-4 transition hover:border-accent hover:bg-white"
        >
          <span>
            <span className="block font-[family-name:var(--font-display)] text-lg font-medium text-ink">
              夸克网盘 · 全部课程打包下载
            </span>
            <span className="mt-1 block text-sm text-muted">
              一次获取全部课程包，适合整库备份
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-warm">打开 ↗</span>
        </a>
      </header>

      {user ? (
        <p className="mt-6 flex flex-wrap items-center gap-1.5 text-sm text-muted animate-rise-delay-1">
          <span>当前账号：{user.nickname || user.username}</span>
          {user.isVip ? (
            <span className="inline-flex items-center gap-1 text-accent-deep">
              <VipBadge size={13} />
              会员
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center animate-rise-delay-2">
        <label className="relative block flex-1">
          <span className="sr-only">搜索课程</span>
          <input
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              startTransition(() => setQuery(v));
            }}
            placeholder="搜索课程名称、主题…"
            className="w-full rounded-2xl border border-line/10 bg-white/85 px-4 py-3 text-sm text-ink outline-none ring-accent/30 transition placeholder:text-muted/70 focus:border-accent focus:ring-2"
          />
        </label>
        <p className="text-xs text-muted sm:shrink-0">
          {pending ? "筛选中…" : `显示 ${filtered.reduce((n, c) => n + c.courseCount, 0)} 门`}
        </p>
      </div>

      <nav
        className="mt-6 flex flex-wrap gap-2.5 animate-rise-delay-3"
        aria-label="课程分类"
      >
        <button
          type="button"
          onClick={() => setActiveSlug("all")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            activeSlug === "all"
              ? "bg-ink text-white shadow-sm"
              : "border border-line/10 bg-white/80 text-ink hover:border-accent/50"
          }`}
        >
          <CategoryIcon slug="all" size={16} />
          全部
        </button>
        {categories.map((cat) => {
          const active = activeSlug === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setActiveSlug(cat.slug)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition"
              style={
                active
                  ? {
                      background: cat.accentColor || "var(--ink)",
                      color: "#fff",
                      boxShadow: "0 1px 2px rgba(15, 36, 56, 0.12)",
                    }
                  : {
                      background: cat.tintColor || "rgba(255,255,255,0.85)",
                      color: "var(--ink)",
                      border: "1px solid var(--line)",
                    }
              }
            >
              <CategoryIcon slug={cat.slug} size={16} />
              {cat.title}
              <span className="text-xs opacity-70">{cat.courseCount}</span>
            </button>
          );
        })}
      </nav>

      {error ? (
        <p className="mt-6 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
          {error}
        </p>
      ) : null}

      <div className="mt-10 space-y-14">
        {filtered.length === 0 && categories.length > 0 ? (
          <p className="text-muted">没有匹配的课程，试试别的关键词。</p>
        ) : null}

        {filtered.map((cat, index) => (
          <section
            key={cat.slug}
            id={`cat-${cat.slug}`}
            className="scroll-mt-24"
            style={{ animationDelay: `${Math.min(index, 4) * 0.06}s` }}
          >
            <div
              className="relative overflow-hidden rounded-[1.75rem] px-5 py-6 sm:px-8 sm:py-7"
              style={{ background: cat.tintColor || "#eef2f6" }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-40"
                style={{ background: cat.accentColor || "#1ec8a5" }}
              />
              <div
                className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full opacity-25"
                style={{ background: cat.accentColor || "#1ec8a5" }}
              />
              <div className="relative flex items-start gap-4">
                <span
                  className="mt-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white sm:h-14 sm:w-14"
                  style={{ background: cat.accentColor || "#1ec8a5" }}
                >
                  <CategoryIcon slug={cat.slug} size={28} />
                </span>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: cat.accentColor || "var(--accent-deep)" }}
                  >
                    {cat.subtitle || cat.slug}
                  </p>
                  <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink sm:text-3xl">
                    {cat.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                    {cat.description}
                  </p>
                  <p className="mt-3 text-xs text-muted">{cat.courseCount} 门课程</p>
                </div>
              </div>
            </div>

            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {cat.courses.map((course) => (
                <li
                  key={course.id}
                  className="flex flex-col rounded-[1.25rem] border border-line/10 bg-white/85 p-5 transition hover:border-accent/35"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-ink">
                      {displayTitle(course.title)}
                    </h3>
                    <DifficultyBadge
                      difficulty={course.difficulty}
                      level={course.level}
                    />
                  </div>
                  {course.description ? (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted line-clamp-3">
                      {course.description}
                    </p>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <p className="mt-3 text-xs text-muted">
                    {[
                      course.wordCount ? `${course.wordCount} 词` : null,
                      course.durationMinutes
                        ? `约 ${course.durationMinutes} 分钟`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <button
                    type="button"
                    disabled={busyId === course.id}
                    onClick={() => void downloadCourse(course)}
                    className="mt-4 cursor-pointer self-start px-1 py-1 text-sm font-medium text-accent-deep transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === course.id ? "准备中…" : "下载"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {categories.length === 0 && !error ? (
          <p className="text-muted">正在加载课程…</p>
        ) : null}
      </div>
    </PageShell>
  );
}
