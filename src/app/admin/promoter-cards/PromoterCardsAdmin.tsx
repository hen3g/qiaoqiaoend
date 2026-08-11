"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Message,
  Modal,
  Radio,
  Space,
  Table,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";

type PromoterCode = {
  id: number;
  code: string;
  days: number;
  label: string;
  maxUses: number;
  usedCount: number;
  createdAt: string | null;
};

type BoundUser = {
  id: number;
  username: string;
  nickname: string | null;
  redeemedAt: string | null;
};

const DAY_OPTIONS = [7, 30] as const;

export function PromoterCardsAdmin() {
  const [codes, setCodes] = useState<PromoterCode[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [codeText, setCodeText] = useState("");
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(7);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [boundUsers, setBoundUsers] = useState<BoundUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promoter/codes");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setCodes(data.codes ?? []);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  async function createCode() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/promoter/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeText, days }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "创建失败");
        return;
      }
      Message.success(data.message || "已创建");
      setCodeText("");
      await loadCodes();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  function onDelete(id: number) {
    Modal.confirm({
      title: "确认删除",
      content: "确定删除该推广兑换码？已兑换记录也会一并清除。",
      okButtonProps: { status: "danger" },
      onOk: async () => {
        setError("");
        setDeletingId(id);
        try {
          const res = await fetch(`/api/promoter/codes/${id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(data.error || "删除失败");
            return;
          }
          Message.success(data.message || "已删除");
          if (expandedId === id) {
            setExpandedId(null);
            setBoundUsers([]);
          }
          await loadCodes();
        } catch {
          setError("网络错误");
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  async function toggleUsers(codeId: number) {
    if (expandedId === codeId) {
      setExpandedId(null);
      setBoundUsers([]);
      return;
    }
    setExpandedId(codeId);
    setUsersLoading(true);
    setBoundUsers([]);
    try {
      const res = await fetch(`/api/promoter/codes/${codeId}/users`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载绑定用户失败");
        setExpandedId(null);
        return;
      }
      setBoundUsers(data.users ?? []);
    } catch {
      setError("网络错误");
      setExpandedId(null);
    } finally {
      setUsersLoading(false);
    }
  }

  async function copyCode(item: PromoterCode) {
    try {
      await navigator.clipboard.writeText(item.code);
      Message.success("已复制");
    } catch {
      setError("复制失败");
    }
  }

  const canCreate = codes.length < 3;

  const boundColumns: ColumnProps<BoundUser>[] = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "用户名", dataIndex: "username" },
    {
      title: "昵称",
      dataIndex: "nickname",
      render: (v) => v || "—",
    },
    {
      title: "兑换时间",
      dataIndex: "redeemedAt",
      render: (v) => (v ? new Date(v).toLocaleString("zh-CN") : "—"),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="创建兑换码">
        <Typography.Paragraph type="secondary">
          最多创建 3 个兑换码，可选 7 天或 30 天会员。用户兑换后将绑定为你的推广用户。
        </Typography.Paragraph>
        <Form
          layout="vertical"
          style={{ maxWidth: 480 }}
          onSubmit={() => {
            void createCode();
          }}
        >
          <Form.Item
            label="兑换码文本"
            extra="至少 4 位，仅英文或数字"
            required
          >
            <Input
              value={codeText}
              onChange={setCodeText}
              placeholder="例如 MYCODE01"
              maxLength={64}
              disabled={!canCreate || busy}
              style={{ textTransform: "uppercase", fontFamily: "monospace" }}
            />
          </Form.Item>
          <Form.Item label="会员天数">
            <Radio.Group
              type="button"
              value={days}
              onChange={(v) => setDays(v as (typeof DAY_OPTIONS)[number])}
              disabled={!canCreate || busy}
            >
              {DAY_OPTIONS.map((d) => (
                <Radio key={d} value={d}>
                  {d} 天
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            默认可使用 999999 次
          </Typography.Text>
          {!canCreate ? (
            <Alert
              type="warning"
              content="已达 3 个上限，请先删除后再创建。"
              style={{ marginTop: 12, marginBottom: 12 }}
            />
          ) : null}
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={busy}
              disabled={!canCreate || !codeText.trim()}
            >
              创建兑换码
            </Button>
          </div>
        </Form>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card
        title={`我的兑换码（${codes.length}/3）`}
        extra={
          <Button onClick={() => void loadCodes()} loading={loading}>
            刷新
          </Button>
        }
      >
        {!loading && codes.length === 0 ? (
          <Empty description="暂无推广兑换码" />
        ) : (
          <Space direction="vertical" size="medium" style={{ width: "100%" }}>
            {codes.map((item) => (
              <Card key={item.id} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <div>
                    <Typography.Text
                      bold
                      style={{ fontFamily: "monospace", fontSize: 16 }}
                    >
                      {item.code}
                    </Typography.Text>
                    <div>
                      <Typography.Text type="secondary">
                        {item.label} · 已用 {item.usedCount}/{item.maxUses}
                        {item.createdAt
                          ? ` · ${new Date(item.createdAt).toLocaleString("zh-CN")}`
                          : ""}
                      </Typography.Text>
                    </div>
                  </div>
                  <Space>
                    <Button size="small" onClick={() => void copyCode(item)}>
                      复制
                    </Button>
                    <Button
                      size="small"
                      onClick={() => void toggleUsers(item.id)}
                    >
                      {expandedId === item.id ? "收起用户" : "绑定用户"}
                    </Button>
                    <Button
                      size="small"
                      status="danger"
                      loading={deletingId === item.id}
                      onClick={() => onDelete(item.id)}
                    >
                      删除
                    </Button>
                  </Space>
                </Space>

                {expandedId === item.id ? (
                  <div style={{ marginTop: 16 }}>
                    <Table
                      rowKey="id"
                      loading={usersLoading}
                      columns={boundColumns}
                      data={boundUsers}
                      pagination={false}
                      noDataElement={<Empty description="暂无用户兑换此码" />}
                    />
                  </div>
                ) : null}
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
