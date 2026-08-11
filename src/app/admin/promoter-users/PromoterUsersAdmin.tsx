"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import type { PaginationProps } from "@arco-design/web-react/es/Pagination/interface";

type ReferredUser = {
  id: number;
  username: string;
  nickname: string | null;
  isVip: boolean;
  vipExpiresAt: string | null;
  diamonds: number;
  createdAt: string | null;
  redeemCode: string | null;
  redeemedAt: string | null;
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function PromoterUsersAdmin() {
  const [users, setUsers] = useState<ReferredUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");
  const [queryText, setQueryText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (queryText.trim()) params.set("q", queryText.trim());

      const res = await fetch(`/api/promoter/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setUsers(data.users ?? []);
      setTotal(Number(data.total ?? 0));
      setError("");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, queryText]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const columns: ColumnProps<ReferredUser>[] = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "用户",
      width: 180,
      render: (_, u) => (
        <div>
          <Typography.Text bold>
            {u.nickname || u.username}
          </Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              @{u.username}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "会员",
      width: 100,
      render: (_, u) =>
        u.isVip ? (
          <Tag color="arcoblue">会员</Tag>
        ) : (
          <Typography.Text type="secondary">非会员</Typography.Text>
        ),
    },
    {
      title: "钻石",
      dataIndex: "diamonds",
      width: 80,
    },
    {
      title: "使用兑换码",
      dataIndex: "redeemCode",
      width: 140,
      render: (v) =>
        v ? (
          <Typography.Text code>{v}</Typography.Text>
        ) : (
          "—"
        ),
    },
    {
      title: "兑换时间",
      width: 170,
      render: (_, u) => formatTime(u.redeemedAt),
    },
    {
      title: "注册时间",
      width: 170,
      render: (_, u) => formatTime(u.createdAt),
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
      <Card title="推广用户">
        <Typography.Paragraph type="secondary">
          查看通过你的推广码绑定的全部用户。用户首次兑换你的推广码后会永久绑定到你名下。
        </Typography.Paragraph>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="用户名 / 昵称 / ID"
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
          <Button onClick={() => void loadUsers()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card>
        <Statistic title="累计推广用户" value={total} style={{ marginBottom: 16 }} />
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={users}
          pagination={pagination}
          scroll={{ x: 1000 }}
        />
      </Card>
    </Space>
  );
}
