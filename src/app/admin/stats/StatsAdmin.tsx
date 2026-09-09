"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Radio,
  Space,
  Statistic,
  Table,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { ClientAppFilter } from "@/lib/client-app";
import { CLIENT_APP_FILTER_LABELS } from "@/lib/client-app";

const { Row, Col } = Grid;

type DailyStat = {
  date: string;
  anonymous: number;
  ios: number;
  android: number;
  registrations: number;
  registrationsIos: number;
  registrationsAndroid: number;
};

export function StatsAdmin({
  defaultApp = "qiaoqiao",
  lockApp = false,
}: {
  defaultApp?: ClientAppFilter;
  lockApp?: boolean;
}) {
  const [app, setApp] = useState<ClientAppFilter>(defaultApp);
  const [days, setDays] = useState<DailyStat[]>([]);
  const [today, setToday] = useState<DailyStat | null>(null);
  const [detail, setDetail] = useState<DailyStat | null>(null);
  const [detailDate, setDetailDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(
    async (date?: string, nextApp = app) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("app", nextApp);
        if (date) params.set("date", date);
        const res = await fetch(`/api/admin/stats?${params.toString()}`);
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
    },
    [app],
  );

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
    { title: "登录 iOS", dataIndex: "ios" },
    { title: "登录 Android", dataIndex: "android" },
    { title: "注册", dataIndex: "registrations" },
    { title: "注册 iOS", dataIndex: "registrationsIos" },
    { title: "注册 Android", dataIndex: "registrationsAndroid" },
  ];

  const appLabel = CLIENT_APP_FILTER_LABELS[app];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title={lockApp && defaultApp === "hamster" ? "数据统计" : "日活统计"}
        extra={
          <Button
            onClick={() => void loadStats(detailDate || undefined)}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          按 App 分开统计。客户端每日上报一次：未登录按设备去重；登录后按用户去重并区分
          iOS / Android。注册数按当日新建账号统计，并区分注册平台（旧用户无平台记为总数中的未知）。未带头的旧客户端记入敲敲英语。
        </Typography.Paragraph>
        {lockApp ? null : (
          <Radio.Group
            type="button"
            value={app}
            onChange={(value) => {
              const next = value as ClientAppFilter;
              setApp(next);
              void loadStats(undefined, next);
            }}
          >
            <Radio value="all">全部应用</Radio>
            <Radio value="qiaoqiao">敲敲英语</Radio>
            <Radio value="hamster">仓鼠单词</Radio>
          </Radio.Group>
        )}
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {today ? (
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`${appLabel} · 今日未登录`}
                value={today.anonymous}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`${appLabel} · 今日登录 iOS`}
                value={today.ios}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`${appLabel} · 今日登录 Android`}
                value={today.android}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`${appLabel} · 今日注册`}
                value={today.registrations}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`${appLabel} · 今日注册 iOS`}
                value={today.registrationsIos ?? 0}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`${appLabel} · 今日注册 Android`}
                value={today.registrationsAndroid ?? 0}
              />
            </Card>
          </Col>
        </Row>
      ) : null}

      {detail && detailDate !== today?.date ? (
        <Alert
          type="info"
          content={`已选日期 ${detailDate}（${appLabel}）：未登录 ${detail.anonymous} · 登录 iOS ${detail.ios} · 登录 Android ${detail.android} · 注册 ${detail.registrations}（iOS ${detail.registrationsIos ?? 0} / Android ${detail.registrationsAndroid ?? 0}）`}
        />
      ) : null}

      <Card title={`${appLabel} · 近 30 天`}>
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
