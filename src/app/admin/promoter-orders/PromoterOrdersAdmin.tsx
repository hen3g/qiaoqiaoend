"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Input,
  Radio,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { PaginationProps } from "@arco-design/web-react/es/Pagination/interface";

const { Row, Col } = Grid;

type OrderStatus = "pending" | "paid" | "closed";

type PromoterOrder = {
  id: number;
  outTradeNo: string;
  userId: number;
  username: string | null;
  nickname: string | null;
  planId: string;
  planTitle: string;
  amountFen: number;
  amountYuan: string;
  status: OrderStatus;
  alipayTradeNo: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "all" | OrderStatus;

type OrderSummary = {
  total: number;
  paidCount: number;
  pendingCount: number;
  closedCount: number;
  paidYuan: string;
};

const STATUS_META: Record<OrderStatus, { text: string; color: string }> = {
  pending: { text: "待支付", color: "orangered" },
  paid: { text: "已支付", color: "green" },
  closed: { text: "已关闭", color: "gray" },
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function PromoterOrdersAdmin() {
  const [orders, setOrders] = useState<PromoterOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [queryInput, setQueryInput] = useState("");
  const [queryText, setQueryText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<OrderSummary>({
    total: 0,
    paidCount: 0,
    pendingCount: 0,
    closedCount: 0,
    paidYuan: "0.00",
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (queryText.trim()) params.set("q", queryText.trim());

      const res = await fetch(`/api/promoter/orders?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setOrders(data.orders ?? []);
      setTotal(Number(data.total ?? 0));
      if (data.summary) {
        setSummary({
          total: Number(data.summary.total ?? 0),
          paidCount: Number(data.summary.paidCount ?? 0),
          pendingCount: Number(data.summary.pendingCount ?? 0),
          closedCount: Number(data.summary.closedCount ?? 0),
          paidYuan: String(data.summary.paidYuan ?? "0.00"),
        });
      }
      setError("");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, queryText]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const columns: ColumnProps<PromoterOrder>[] = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "商户订单号",
      dataIndex: "outTradeNo",
      width: 220,
      render: (v) => (
        <Typography.Text code copyable>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: "用户",
      width: 160,
      render: (_, o) => (
        <div>
          <Typography.Text bold>
            {o.nickname || o.username || `用户#${o.userId}`}
          </Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              @{o.username ?? "—"} · #{o.userId}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "套餐",
      dataIndex: "planTitle",
      width: 100,
      render: (v) => <Tag color="arcoblue">{v}</Tag>,
    },
    {
      title: "金额",
      width: 90,
      render: (_, o) => `¥${o.amountYuan}`,
    },
    {
      title: "状态",
      width: 100,
      render: (_, o) => {
        const meta = STATUS_META[o.status];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: "支付时间",
      width: 170,
      render: (_, o) => formatTime(o.paidAt),
    },
    {
      title: "创建时间",
      width: 170,
      render: (_, o) => formatTime(o.createdAt),
    },
  ];

  const pagination: PaginationProps = {
    current: page,
    pageSize,
    total,
    showTotal: true,
    sizeCanChange: true,
    pageSizeChangeResetCurrent: true,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="推广订单">
        <Typography.Paragraph type="secondary">
          查看你名下推广用户的全部 VIP 购买订单。仅展示已通过推广码绑定到你的用户产生的订单。
        </Typography.Paragraph>
        <Space wrap>
          <Radio.Group
            type="button"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as StatusFilter);
              setPage(1);
            }}
          >
            <Radio value="all">全部</Radio>
            <Radio value="paid">已支付</Radio>
            <Radio value="pending">待支付</Radio>
            <Radio value="closed">已关闭</Radio>
          </Radio.Group>
          <Input.Search
            allowClear
            placeholder="订单号 / 用户 / 套餐"
            value={queryInput}
            onChange={setQueryInput}
            onSearch={(value) => {
              setQueryText(value.trim());
              setPage(1);
            }}
            onClear={() => {
              setQueryInput("");
              setQueryText("");
              setPage(1);
            }}
            style={{ width: 280 }}
          />
          <Button onClick={() => void loadOrders()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="匹配订单" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已支付" value={summary.paidCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="待支付" value={summary.pendingCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已支付金额（¥）" value={summary.paidYuan} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={orders}
          pagination={pagination}
          scroll={{ x: 1100 }}
        />
      </Card>
    </Space>
  );
}
