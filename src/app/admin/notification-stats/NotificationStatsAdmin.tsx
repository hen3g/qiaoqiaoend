"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Space,
  Statistic,
  Table,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";

const { Row, Col } = Grid;

type DailyStat = {
  date: string;
  totalHits: number;
  loggedInHits: number;
  uniqueUsers: number;
};

type DailyUser = {
  userId: number;
  username: string | null;
  nickname: string | null;
  hitCount: number;
  sources?: ("client" | "web")[];
};

function sourcesLabel(sources: ("client" | "web")[] | undefined): string {
  if (!sources || sources.length === 0) return "—";
  const hasClient = sources.includes("client");
  const hasWeb = sources.includes("web");
  if (hasClient && hasWeb) return "都使用了";
  if (hasWeb) return "在线版";
  return "客户端";
}

export function NotificationStatsAdmin() {
  const [days, setDays] = useState<DailyStat[]>([]);
  const [today, setToday] = useState<DailyStat | null>(null);
  const [detailDate, setDetailDate] = useState("");
  const [users, setUsers] = useState<DailyUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const qs = date ? `?date=${encodeURIComponent(date)}` : "";
      const res = await fetch(`/api/admin/notification-stats${qs}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setDays(data.days ?? []);
      setToday(data.today ?? null);
      setDetailDate(data.detailDate ?? "");
      setUsers(data.users ?? []);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const dayColumns: ColumnProps<DailyStat>[] = [
    {
      title: "日期",
      dataIndex: "date",
      render: (date) => (
        <Button type="text" onClick={() => void loadStats(date)}>
          {date}
        </Button>
      ),
    },
    { title: "总请求", dataIndex: "totalHits" },
    { title: "带登录请求", dataIndex: "loggedInHits" },
    { title: "独立用户", dataIndex: "uniqueUsers" },
  ];

  const userColumns: ColumnProps<DailyUser>[] = [
    { title: "用户 ID", dataIndex: "userId", width: 100 },
    {
      title: "用户名",
      dataIndex: "username",
      render: (v) => v || "—",
    },
    {
      title: "昵称",
      dataIndex: "nickname",
      render: (v) => v || "—",
    },
    {
      title: "来源",
      render: (_, u) => sourcesLabel(u.sources),
    },
    { title: "请求次数", dataIndex: "hitCount" },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="通知接口统计"
        extra={
          <Button
            onClick={() => void loadStats(detailDate || undefined)}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          统计公开接口 GET /api/notifications
          的调用。带登录态的请求会按用户 ID 去重估算日活。
        </Typography.Paragraph>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {today ? (
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="今日请求" value={today.totalHits} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="今日带登录请求" value={today.loggedInHits} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="今日独立用户" value={today.uniqueUsers} />
            </Card>
          </Col>
        </Row>
      ) : null}

      <Card title="近 30 天">
        <Table
          rowKey="date"
          loading={loading}
          columns={dayColumns}
          data={days}
          pagination={false}
          rowClassName={(record) =>
            record.date === detailDate ? "arco-table-tr-checked" : ""
          }
        />
      </Card>

      <Card title={`${detailDate || "今日"} 登录用户明细`}>
        <Typography.Paragraph type="secondary">
          仅统计成功解析出用户 ID 的请求。
        </Typography.Paragraph>
        <Table
          rowKey="userId"
          loading={loading}
          columns={userColumns}
          data={users}
          pagination={{ pageSize: 20, showTotal: true }}
        />
      </Card>
    </Space>
  );
}
