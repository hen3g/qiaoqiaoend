"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const { Row, Col } = Grid;

type ManorOverview = {
  syncedUsers: number;
  wishedUsers: number;
  stockUsers: number;
  placedUsers: number;
  paidWishCount: number;
  paidUsers: number;
  diamondsSpent: number;
};

type ManorPaidUser = {
  userId: number;
  username: string | null;
  nickname: string | null;
  wishCount: number;
  diamondsSpent: number;
  isTest: boolean;
};

type ManorTopItem = {
  itemId: string;
  held: number;
  stock: number;
  placed: number;
};

type ManorActivity = {
  firstSyncAt: string | null;
  lastSyncAt: string | null;
  firstWishAt: string | null;
  lastWishAt: string | null;
  firstPaidWishAt: string | null;
  lastPaidWishAt: string | null;
};

type ManorStatsResponse = {
  ok: boolean;
  error?: string;
  appId: string;
  testUserId: number;
  all: ManorOverview;
  excludingTest: ManorOverview;
  activity: ManorActivity;
  paidBreakdown: ManorPaidUser[];
  topItems: ManorTopItem[];
  footnotes: string[];
};

type Scope = "all" | "ex";

function formatShanghai(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function ManorStatsAdmin() {
  const [data, setData] = useState<ManorStatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("ex");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manor-stats");
      const json = (await res.json()) as ManorStatsResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || "加载失败");
        return;
      }
      setData(json);
      setError("");
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overview = scope === "all" ? data?.all : data?.excludingTest;

  const paidRows = useMemo(() => {
    const rows = data?.paidBreakdown ?? [];
    return scope === "ex" ? rows.filter((r) => !r.isTest) : rows;
  }, [data, scope]);

  const paidColumns: ColumnProps<ManorPaidUser>[] = [
    { title: "用户 ID", dataIndex: "userId", width: 100 },
    {
      title: "用户名",
      dataIndex: "username",
      render: (v, row) => (
        <span>
          {v || "—"}
          {row.isTest ? (
            <Typography.Text type="secondary">（测试）</Typography.Text>
          ) : null}
        </span>
      ),
    },
    {
      title: "昵称",
      dataIndex: "nickname",
      render: (v) => v || "—",
    },
    { title: "付费次数", dataIndex: "wishCount", width: 100 },
    { title: "耗钻", dataIndex: "diamondsSpent", width: 100 },
  ];

  const itemColumns: ColumnProps<ManorTopItem>[] = [
    { title: "物品 ID", dataIndex: "itemId" },
    { title: "合计持有", dataIndex: "held", width: 110 },
    { title: "背包 stock", dataIndex: "stock", width: 120 },
    { title: "已摆放", dataIndex: "placed", width: 100 },
  ];

  const cards: { title: string; key: keyof ManorOverview }[] = [
    { title: "云同步人数", key: "syncedUsers" },
    { title: "至少许愿人数", key: "wishedUsers" },
    { title: "有背包库存人数", key: "stockUsers" },
    { title: "摆放过物品人数", key: "placedUsers" },
    { title: "钻石付费次数", key: "paidWishCount" },
    { title: "付费用户数", key: "paidUsers" },
    { title: "庄园耗钻总数", key: "diamondsSpent" },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="仓鼠庄园统计"
        extra={
          <Space>
            <Radio.Group
              type="button"
              value={scope}
              onChange={(v) => setScope(v as Scope)}
            >
              <Radio value="all">全部</Radio>
              <Radio value="ex">去测试</Radio>
            </Radio.Group>
            <Button onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          仓鼠单词庄园（许愿 / 云同步 / 钻石付费）实时统计。当前视图：
          {scope === "all"
            ? "全部用户"
            : `排除测试号 id=${data?.testUserId ?? 8}`}
          。
        </Typography.Paragraph>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col key={c.key} xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title={c.title}
                value={overview?.[c.key] ?? 0}
                groupSeparator
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="活动时间窗">
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">首次云同步</Typography.Text>
            <div>{formatShanghai(data?.activity.firstSyncAt)}</div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">最近云同步</Typography.Text>
            <div>{formatShanghai(data?.activity.lastSyncAt)}</div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">首次许愿快照</Typography.Text>
            <div>{formatShanghai(data?.activity.firstWishAt)}</div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">最近许愿快照</Typography.Text>
            <div>{formatShanghai(data?.activity.lastWishAt)}</div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">首次钻石许愿</Typography.Text>
            <div>{formatShanghai(data?.activity.firstPaidWishAt)}</div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">最近钻石许愿</Typography.Text>
            <div>{formatShanghai(data?.activity.lastPaidWishAt)}</div>
          </Col>
        </Row>
      </Card>

      <Card title="钻石付费明细">
        <Typography.Paragraph type="secondary">
          来自 diamond_transactions（type = manor_wish）。每次付费消耗 5
          钻。
        </Typography.Paragraph>
        <Table
          rowKey="userId"
          loading={loading}
          columns={paidColumns}
          data={paidRows}
          pagination={false}
        />
      </Card>

      <Card title="当前持有物品 Top（快照）">
        <Typography.Paragraph type="secondary">
          汇总全部云同步快照：背包 stock + 院子 placed。不含历史已丢弃物品。
        </Typography.Paragraph>
        <Table
          rowKey="itemId"
          loading={loading}
          columns={itemColumns}
          data={data?.topItems ?? []}
          pagination={{ pageSize: 15, showTotal: true }}
        />
      </Card>

      <Card title="说明">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {(data?.footnotes ?? []).map((line) => (
            <li key={line}>
              <Typography.Text type="secondary">{line}</Typography.Text>
            </li>
          ))}
        </ul>
      </Card>
    </Space>
  );
}
