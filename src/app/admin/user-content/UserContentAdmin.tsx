"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageShell } from "@/components/PageShell";
import type {
  AdminUserCourse,
  AdminUserPaper,
} from "@/lib/user-content-admin";

type KindFilter = "all" | "course" | "paper";

type ContentRow =
  | ({ kind: "course" } & AdminUserCourse)
  | ({ kind: "paper" } & AdminUserPaper);

function displayName(username: string | null, nickname: string | null, userId: number) {
  return nickname || username || `用户 #${userId}`;
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function contentId(row: ContentRow): string {
  return row.kind === "course" ? row.courseId : row.paperId;
}

export function UserContentAdmin() {
  const { user, status: authStatus } = useAuth();
  const [courses, setCourses] = useState<AdminUserCourse[]>([]);
  const [papers, setPapers] = useState<AdminUserPaper[]>([]);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [listLoaded, setListLoaded] = useState(false);

  const loadContent = useCallback(async () => {
    const res = await fetch("/api/admin/user-content");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setCourses(data.courses ?? []);
    setPapers(data.papers ?? []);
    setError("");
  }, []);

  useEffect(() => {
    if (
      authStatus !== "ready" ||
      !user ||
      user.username.toLowerCase() !== "channg"
    ) {
      return;
    }
    let cancelled = false;
    setListLoaded(false);
    void loadContent().finally(() => {
      if (!cancelled) setListLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authStatus, user, loadContent]);

  const rows = useMemo<ContentRow[]>(() => {
    const courseRows: ContentRow[] = courses.map((c) => ({
      kind: "course",
      ...c,
    }));
    const paperRows: ContentRow[] = papers.map((p) => ({
      kind: "paper",
      ...p,
    }));
    return [...courseRows, ...paperRows].sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
  }, [courses, papers]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        (row.username?.toLowerCase().includes(q) ?? false) ||
        (row.nickname?.toLowerCase().includes(q) ?? false) ||
        String(row.userId).includes(q) ||
        row.title.toLowerCase().includes(q) ||
        contentId(row).toLowerCase().includes(q)
      );
    });
  }, [rows, queryText, kindFilter]);

  const userCount = useMemo(
    () => new Set(rows.map((r) => r.userId)).size,
    [rows],
  );

  if (authStatus === "loading") {
    return (
      <PageShell>
        <p className="text-muted">加载中…</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          用户课程与套卷
        </h1>
        <p className="mt-4 text-muted">
          请先以管理员账号{" "}
          <Link href="/login" className="text-accent-deep hover:underline">
            登录
          </Link>
          。
        </p>
      </PageShell>
    );
  }

  if (user.username.toLowerCase() !== "channg") {
    return (
      <PageShell>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          用户课程与套卷
        </h1>
        <p className="mt-4 text-muted">当前账号无权限访问此页面。</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted">仅管理员 channg 可访问</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink">
          用户课程与套卷
        </h1>
        <p className="mt-3 text-muted">
          查看所有用户自建的课程与套卷摘要。数据来自客户端同步表。
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            共 {userCount} 人 · 课程 {courses.length} · 套卷 {papers.length}
          </p>
          <button
            type="button"
            onClick={() => void loadContent()}
            className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-ink hover:border-accent"
          >
            刷新
          </button>
          <Link
            href="/admin/users"
            className="rounded-full border border-line/10 px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-ink"
          >
            用户后台
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "全部"],
                ["course", "课程"],
                ["paper", "套卷"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKindFilter(value)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  kindFilter === value
                    ? "bg-accent/15 text-accent-deep"
                    : "border border-line/10 text-muted hover:border-accent hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block min-w-[14rem] flex-1 max-w-sm">
            <span className="sr-only">搜索</span>
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="搜索用户名 / 昵称 / ID / 标题"
              className="w-full rounded-xl border border-line/10 bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#fff1eb] px-3 py-2 text-sm text-[#c24b1e]">
            {error}
          </p>
        ) : null}

        {!listLoaded ? (
          <p className="mt-8 text-sm text-muted">加载中…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-sm text-muted">
            {rows.length === 0 ? "暂无课程或套卷" : "没有匹配的记录"}
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-[1.25rem] border border-line/10 bg-white/85 shadow-[0_12px_36px_rgba(11,31,51,0.06)]">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line/10 text-xs text-muted">
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">标题</th>
                  <th className="px-4 py-3 font-medium">规模</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={`${row.kind}-${row.userId}-${contentId(row)}`}
                    className="border-b border-line/70 last:border-b-0"
                  >
                    <td className="px-4 py-3.5 align-top">
                      <p className="font-medium text-ink">
                        {displayName(row.username, row.nickname, row.userId)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        @{row.username ?? "—"} · #{row.userId}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.kind === "course"
                            ? "bg-[#eaf2ff] text-accent-deep"
                            : "bg-[#e8fff8] text-[#1a7a5c]"
                        }`}
                      >
                        {row.kind === "course" ? "课程" : "套卷"}
                      </span>
                      {row.kind === "course" ? (
                        <p className="mt-1 text-xs text-muted">
                          {row.difficulty} 星
                          {row.isUserCreated ? " · 自建" : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <p className="max-w-[16rem] font-medium text-ink">
                        {row.title}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-top text-muted">
                      {row.kind === "course" ? (
                        <>
                          {row.wordCount} 词 · {row.lessonCount} 课
                        </>
                      ) : (
                        <>
                          {row.wordCount} 词 · {row.questionCount} 题
                          {row.discardedQuestionCount > 0
                            ? ` · 弃 ${row.discardedQuestionCount}`
                            : ""}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top text-muted whitespace-nowrap">
                      {formatUpdatedAt(row.updatedAt)}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <code className="break-all text-xs text-muted">
                        {contentId(row)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
