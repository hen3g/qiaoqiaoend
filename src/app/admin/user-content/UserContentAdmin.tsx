"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type {
  AdminUserCourse,
  AdminUserPaper,
} from "@/lib/user-content-admin";

type KindFilter = "all" | "course" | "paper";

type ContentRow =
  | ({ kind: "course" } & AdminUserCourse)
  | ({ kind: "paper" } & AdminUserPaper);

function displayName(
  username: string | null,
  nickname: string | null,
  userId: number,
) {
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
  const [courses, setCourses] = useState<AdminUserCourse[]>([]);
  const [papers, setPapers] = useState<AdminUserPaper[]>([]);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [loading, setLoading] = useState(true);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/user-content");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setCourses(data.courses ?? []);
      setPapers(data.papers ?? []);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

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

  const columns: ColumnProps<ContentRow>[] = [
    {
      title: "用户",
      width: 180,
      render: (_, row) => (
        <div>
          <Typography.Text bold>
            {displayName(row.username, row.nickname, row.userId)}
          </Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              @{row.username ?? "—"} · #{row.userId}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "类型",
      width: 120,
      render: (_, row) => (
        <div>
          <Tag color={row.kind === "course" ? "arcoblue" : "green"}>
            {row.kind === "course" ? "课程" : "套卷"}
          </Tag>
          {row.kind === "course" ? (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.difficulty} 星
                {row.isUserCreated ? " · 自建" : ""}
              </Typography.Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "标题",
      dataIndex: "title",
      ellipsis: true,
    },
    {
      title: "规模",
      width: 160,
      render: (_, row) =>
        row.kind === "course" ? (
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
        ),
    },
    {
      title: "更新时间",
      width: 180,
      render: (_, row) => formatUpdatedAt(row.updatedAt),
    },
    {
      title: "ID",
      width: 200,
      render: (_, row) => (
        <Typography.Text code style={{ fontSize: 12 }}>
          {contentId(row)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="用户课程与套卷">
        <Typography.Paragraph type="secondary">
          查看所有用户自建的课程与套卷摘要。数据来自客户端同步表。共 {userCount}{" "}
          人 · 课程 {courses.length} · 套卷 {papers.length}
        </Typography.Paragraph>
        <Space wrap>
          <Radio.Group
            type="button"
            value={kindFilter}
            onChange={(v) => setKindFilter(v as KindFilter)}
          >
            <Radio value="all">全部</Radio>
            <Radio value="course">课程</Radio>
            <Radio value="paper">套卷</Radio>
          </Radio.Group>
          <Input.Search
            allowClear
            placeholder="搜索用户名 / 昵称 / ID / 标题"
            value={queryText}
            onChange={setQueryText}
            style={{ width: 280 }}
          />
          <Button onClick={() => void loadContent()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card>
        <Table
          rowKey={(row) => `${row.kind}-${row.userId}-${contentId(row)}`}
          loading={loading}
          columns={columns}
          data={filtered}
          pagination={{ pageSize: 20, showTotal: true }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </Space>
  );
}
