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

type PayChannel = "alipay" | "apple";
type OrderStatus = "pending" | "paid" | "closed";
type AppleOrderStatus = "paid" | "refunded";
type AppleKind = "vip" | "diamonds";

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

type PromoterAppleOrder = {
  transactionId: string;
  originalTransactionId: string;
  userId: number;
  username: string | null;
  nickname: string | null;
  productId: string;
  kind: AppleKind;
  grantId: string;
  planTitle: string;
  billing: "consumable" | "auto-renewable" | null;
  environment: string;
  amountFen: number;
  amountYuan: string;
  amountDisplay?: string;
  currency?: string;
  currencyLabel?: string;
  catalogAmountFen?: number;
  catalogAmountYuan?: string;
  discounted?: boolean;
  offerType?: number | null;
  status: AppleOrderStatus;
  diamondsGranted: number;
  diamondsRefunded: number;
  createdAt: string;
};

type StatusFilter = "all" | OrderStatus;
type AppleStatusFilter = "all" | AppleOrderStatus;
type AppleKindFilter = "all" | AppleKind;

type OrderSummary = {
  total: number;
  paidCount: number;
  pendingCount: number;
  closedCount: number;
  paidYuan: string;
};

type AppleSummary = {
  total: number;
  paidCount: number;
  refundedCount: number;
  paidYuan: string;
  paidDisplay: string;
};

const STATUS_META: Record<OrderStatus, { text: string; color: string }> = {
  pending: { text: "待支付", color: "orangered" },
  paid: { text: "已支付", color: "green" },
  closed: { text: "已关闭", color: "gray" },
};

const APPLE_STATUS_META: Record<
  AppleOrderStatus,
  { text: string; color: string }
> = {
  paid: { text: "已支付", color: "green" },
  refunded: { text: "已退款", color: "orangered" },
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function userCell(o: {
  nickname: string | null;
  username: string | null;
  userId: number;
}) {
  return (
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
  );
}

export function PromoterOrdersAdmin() {
  const [channel, setChannel] = useState<PayChannel>("alipay");
  const [orders, setOrders] = useState<PromoterOrder[]>([]);
  const [appleOrders, setAppleOrders] = useState<PromoterAppleOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [appleStatusFilter, setAppleStatusFilter] =
    useState<AppleStatusFilter>("all");
  const [appleKindFilter, setAppleKindFilter] = useState<AppleKindFilter>("all");
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
  const [appleSummary, setAppleSummary] = useState<AppleSummary>({
    total: 0,
    paidCount: 0,
    refundedCount: 0,
    paidYuan: "0.00",
    paidDisplay: "¥0.00",
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (queryText.trim()) params.set("q", queryText.trim());

      if (channel === "apple") {
        if (appleStatusFilter !== "all") params.set("status", appleStatusFilter);
        if (appleKindFilter !== "all") params.set("kind", appleKindFilter);
        const res = await fetch(
          `/api/promoter/apple-orders?${params.toString()}`,
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || "加载失败");
          return;
        }
        setAppleOrders(data.orders ?? []);
        setTotal(Number(data.total ?? 0));
        if (data.summary) {
          setAppleSummary({
            total: Number(data.summary.total ?? 0),
            paidCount: Number(data.summary.paidCount ?? 0),
            refundedCount: Number(data.summary.refundedCount ?? 0),
            paidYuan: String(data.summary.paidYuan ?? "0.00"),
            paidDisplay: String(
              data.summary.paidDisplay ?? `¥${data.summary.paidYuan ?? "0.00"}`,
            ),
          });
        }
        setError("");
        return;
      }

      if (statusFilter !== "all") params.set("status", statusFilter);
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
  }, [
    channel,
    page,
    pageSize,
    statusFilter,
    appleStatusFilter,
    appleKindFilter,
    queryText,
  ]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const alipayColumns: ColumnProps<PromoterOrder>[] = [
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
      render: (_, o) => userCell(o),
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

  const appleColumns: ColumnProps<PromoterAppleOrder>[] = [
    {
      title: "Apple 交易号",
      width: 240,
      render: (_, o) => (
        <div>
          <Typography.Text code copyable>
            {o.transactionId}
          </Typography.Text>
          {o.originalTransactionId &&
          o.originalTransactionId !== o.transactionId ? (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                原始 {o.originalTransactionId}
              </Typography.Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "用户",
      width: 160,
      render: (_, o) => userCell(o),
    },
    {
      title: "类型",
      width: 90,
      render: (_, o) => (
        <Tag color={o.kind === "vip" ? "purple" : "gold"}>
          {o.kind === "vip" ? "会员" : "钻石"}
        </Tag>
      ),
    },
    {
      title: "套餐",
      width: 120,
      render: (_, o) => (
        <Space size={4}>
          <Tag color="arcoblue">{o.planTitle}</Tag>
          {o.billing === "auto-renewable" ? (
            <Tag color="cyan">订阅</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: "实付",
      width: 160,
      render: (_, o) => (
        <Space size={4}>
          <span>{o.amountDisplay ?? `¥${o.amountYuan}`}</span>
          {o.currency && o.currency !== "CNY" ? (
            <Tag color="blue">{o.currencyLabel || o.currency}</Tag>
          ) : null}
          {o.discounted ? <Tag color="magenta">优惠</Tag> : null}
        </Space>
      ),
    },
    {
      title: "状态",
      width: 90,
      render: (_, o) => {
        const meta = APPLE_STATUS_META[o.status];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: "钻石",
      width: 120,
      render: (_, o) =>
        o.diamondsRefunded > 0
          ? `${o.diamondsGranted}（退 ${o.diamondsRefunded}）`
          : String(o.diamondsGranted),
    },
    {
      title: "时间",
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

  const isApple = channel === "apple";

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="推广订单">
        <Typography.Paragraph type="secondary">
          {isApple
            ? "查看你名下推广用户的 App Store 内购订单（会员与钻石）。仅展示已通过推广码绑定到你的用户。金额按收据货币显示，外币不与国内目录价对比标优惠。"
            : "查看你名下推广用户的全部支付宝购买订单。仅展示已通过推广码绑定到你的用户产生的订单。"}
        </Typography.Paragraph>
        <Space wrap>
          <Radio.Group
            type="button"
            value={channel}
            onChange={(v) => {
              setChannel(v as PayChannel);
              setPage(1);
            }}
          >
            <Radio value="alipay">支付宝</Radio>
            <Radio value="apple">Apple 支付</Radio>
          </Radio.Group>
          {isApple ? (
            <>
              <Radio.Group
                type="button"
                value={appleStatusFilter}
                onChange={(v) => {
                  setAppleStatusFilter(v as AppleStatusFilter);
                  setPage(1);
                }}
              >
                <Radio value="all">全部</Radio>
                <Radio value="paid">已支付</Radio>
                <Radio value="refunded">已退款</Radio>
              </Radio.Group>
              <Radio.Group
                type="button"
                value={appleKindFilter}
                onChange={(v) => {
                  setAppleKindFilter(v as AppleKindFilter);
                  setPage(1);
                }}
              >
                <Radio value="all">全部商品</Radio>
                <Radio value="vip">会员</Radio>
                <Radio value="diamonds">钻石</Radio>
              </Radio.Group>
            </>
          ) : (
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
          )}
          <Input.Search
            allowClear
            placeholder={
              isApple ? "交易号 / 用户 / 套餐" : "订单号 / 用户 / 套餐"
            }
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

      {isApple ? (
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="匹配订单" value={appleSummary.total} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="已支付" value={appleSummary.paidCount} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="已退款" value={appleSummary.refundedCount} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="已支付实付"
                value={appleSummary.paidDisplay || `¥${appleSummary.paidYuan}`}
              />
            </Card>
          </Col>
        </Row>
      ) : (
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
      )}

      <Card>
        {isApple ? (
          <Table
            rowKey="transactionId"
            loading={loading}
            columns={appleColumns}
            data={appleOrders}
            pagination={pagination}
            scroll={{ x: 1200 }}
          />
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            columns={alipayColumns}
            data={orders}
            pagination={pagination}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>
    </Space>
  );
}
