"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Message,
  Space,
  Table,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import type { ClientAppFilter, ClientAppId } from "@/lib/client-app";
import {
  CLIENT_APP_FILTER_LABELS,
  clientAppLabel,
  clientAppTagColor,
} from "@/lib/client-app";

type ClientUsage = "none" | "client" | "web" | "both";

type AdminUser = SessionUser & {
  tokenVersion: number;
  unlockedDifficulty: number;
  hasClient: boolean;
  hasWeb: boolean;
  clientUsage: ClientUsage;
  lastNotificationAt: string | null;
  notificationHitCount: number;
  registerAppId: ClientAppId;
  lastAppId: ClientAppId | null;
};

const USAGE_LABEL: Record<ClientUsage, string> = {
  none: "未检测到",
  client: "客户端",
  web: "在线版",
  both: "都使用了",
};

function vipLabel(u: AdminUser): string {
  if (!u.isVip) return "非会员";
  if (u.isPermanentVip) return "永久会员";
  if (u.vipExpiresAt) {
    return `至 ${new Date(u.vipExpiresAt).toLocaleDateString("zh-CN")}`;
  }
  return "会员";
}

function usageLabel(u: AdminUser): ClientUsage {
  if (u.clientUsage) return u.clientUsage;
  return u.hasClient && u.hasWeb
    ? "both"
    : u.hasClient
      ? "client"
      : u.hasWeb
        ? "web"
        : "none";
}

export function UsersAdmin({
  app = "qiaoqiao",
}: {
  app?: ClientAppFilter;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const appLabel = CLIENT_APP_FILTER_LABELS[app];

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("app", app);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setUsers(data.users ?? []);
      setError("");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.nickname?.toLowerCase().includes(q) ?? false) ||
        String(u.id).includes(q),
    );
  }, [users, queryText]);

  const vipCount = useMemo(() => users.filter((u) => u.isVip).length, [users]);
  const promoterCount = useMemo(
    () => users.filter((u) => u.isPromoter).length,
    [users],
  );

  const usageCounts = useMemo(() => {
    let clientOnly = 0;
    let webOnly = 0;
    let both = 0;
    for (const u of users) {
      const usage = usageLabel(u);
      if (usage === "client") clientOnly += 1;
      else if (usage === "web") webOnly += 1;
      else if (usage === "both") both += 1;
    }
    return { clientOnly, webOnly, both };
  }, [users]);

  async function togglePromoter(target: AdminUser) {
    setError("");
    setTogglingId(target.id);
    try {
      const next = !target.isPromoter;
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id, isPromoter: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "更新失败");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.id ? { ...u, isPromoter: next } : u,
        ),
      );
      Message.success(data.message || (next ? "已设为推广者" : "已取消推广者"));
    } catch {
      setError("网络错误");
    } finally {
      setTogglingId(null);
    }
  }

  const columns: ColumnProps<AdminUser>[] = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "用户名", dataIndex: "username", width: 120 },
    {
      title: "昵称",
      dataIndex: "nickname",
      width: 120,
      render: (v) => v || "—",
    },
    {
      title: "星级",
      dataIndex: "unlockedDifficulty",
      width: 80,
      render: (v) => `${v ?? 1} 星`,
    },
    {
      title: "客户端",
      width: 160,
      render: (_, u) => {
        const usage = usageLabel(u);
        if (usage === "none") {
          return <Typography.Text type="secondary">{USAGE_LABEL.none}</Typography.Text>;
        }
        return (
          <div>
            <Typography.Text>{USAGE_LABEL[usage]}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                最近 {u.lastNotificationAt ?? "—"} · {u.notificationHitCount} 次
              </Typography.Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "App",
      width: 150,
      render: (_, u) => (
        <div>
          <Tag color={clientAppTagColor(u.registerAppId)}>
            注册 {clientAppLabel(u.registerAppId)}
          </Tag>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              最近 {u.lastAppId ? clientAppLabel(u.lastAppId) : "—"}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "会员",
      width: 120,
      render: (_, u) =>
        u.isVip ? (
          <Tag color="arcoblue">{vipLabel(u)}</Tag>
        ) : (
          <Typography.Text type="secondary">{vipLabel(u)}</Typography.Text>
        ),
    },
    {
      title: "钻石",
      dataIndex: "diamonds",
      width: 80,
      render: (v) => v ?? 0,
    },
    {
      title: "推广者",
      width: 120,
      render: (_, u) => (
        <Button
          size="mini"
          type={u.isPromoter ? "primary" : "outline"}
          loading={togglingId === u.id}
          onClick={() => void togglePromoter(u)}
        >
          {u.isPromoter ? "推广者" : "设为推广者"}
        </Button>
      ),
    },
    {
      title: "到期时间",
      width: 160,
      render: (_, u) =>
        u.isPermanentVip
          ? "永久"
          : u.vipExpiresAt
            ? new Date(u.vipExpiresAt).toLocaleString("zh-CN")
            : "—",
    },
    {
      title: "注册时间",
      width: 160,
      render: (_, u) =>
        u.createdAt ? new Date(u.createdAt).toLocaleString("zh-CN") : "—",
    },
    { title: "token_version", dataIndex: "tokenVersion", width: 120 },
    {
      title: "通知",
      width: 100,
      render: (_, u) => (
        <Button
          size="mini"
          type="text"
          onClick={() =>
            router.push(
              `/admin/notifications?user=${encodeURIComponent(u.username)}`,
            )
          }
        >
          发通知
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title={app === "hamster" ? "用户" : "用户后台"}>
        <Typography.Paragraph type="secondary">
          {appLabel}：共 {users.length} 人，会员 {vipCount} 人，推广者 {promoterCount}{" "}
          人；客户端 {usageCounts.clientOnly} 人，在线版 {usageCounts.webOnly}{" "}
          人，都使用了 {usageCounts.both} 人。
        </Typography.Paragraph>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="用户名 / 昵称 / ID"
            value={queryText}
            onChange={setQueryText}
            style={{ width: 260 }}
          />
          <Button onClick={() => void loadUsers()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={filtered}
          pagination={{ pageSize: 20, showTotal: true }}
          scroll={{ x: 1360 }}
        />
      </Card>
    </Space>
  );
}
