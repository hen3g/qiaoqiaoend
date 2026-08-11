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
  anonymous: number;
  ios: number;
  android: number;
  registrations: number;
};

export function StatsAdmin() {
  const [days, setDays] = useState<DailyStat[]>([]);
  const [today, setToday] = useState<DailyStat | null>(null);
  const [detail, setDetail] = useState<DailyStat | null>(null);
  const [detailDate, setDetailDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const qs = date ? `?date=${encodeURIComponent(date)}` : "";
      const res = await fetch(`/api/admin/stats${qs}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setDays(data.days ?? []);
      setToday(data.today ?? null);
      setDetail(data.detail ?? null);
      setDetailDate(data.detailDate ?? "");
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const columns: ColumnProps<DailyStat>[] = [
    {
      title: "日期",
      dataIndex: "date",
      render: (date) => (
        <Button type="text" onClick={() => void loadStats(date)}>
          {date}
        </Button>
      ),
    },
    { title: "未登录", dataIndex: "anonymous" },
    { title: "iOS", dataIndex: "ios" },
    { title: "Android", dataIndex: "android" },
    { title: "注册", dataIndex: "registrations" },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="日活统计"
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
          客户端每日上报一次：未登录按设备去重；登录后按用户去重并区分 iOS /
          Android。注册数为当日新建账号。
        </Typography.Paragraph>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {today ? (
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="今日未登录" value={today.anonymous} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="今日登录 iOS" value={today.ios} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="今日登录 Android" value={today.android} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="今日注册" value={today.registrations} />
            </Card>
          </Col>
        </Row>
      ) : null}

      {detail && detailDate !== today?.date ? (
        <Alert
          type="info"
          content={`已选日期 ${detailDate}：未登录 ${detail.anonymous} · iOS ${detail.ios} · Android ${detail.android} · 注册 ${detail.registrations}`}
        />
      ) : null}

      <Card title="近 30 天">
        <Table
          rowKey="date"
          loading={loading}
          columns={columns}
          data={days}
          pagination={false}
          rowClassName={(record) =>
            record.date === detailDate ? "arco-table-tr-checked" : ""
          }
        />
      </Card>
    </Space>
  );
}
