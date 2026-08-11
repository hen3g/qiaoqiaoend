"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  Message,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { ColumnProps } from "@arco-design/web-react/es/Table";

type RedeemCodeDto = {
  id: number;
  code: string;
  type: string;
  value: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string | null;
  label: string;
  createdBy: number | null;
  isUserGenerated: boolean;
  createdByName: string | null;
};

type SourceFilter = "all" | "user" | "admin";

function codeStatus(c: RedeemCodeDto): { text: string; color: string } {
  if (c.usedCount >= c.maxUses) {
    return { text: "已用尽", color: "red" };
  }
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) {
    return { text: "已过期", color: "gray" };
  }
  if (c.usedCount > 0) {
    return { text: "部分使用", color: "orangered" };
  }
  return { text: "可用", color: "green" };
}

export function RedeemCodesAdmin() {
  const [codes, setCodes] = useState<RedeemCodeDto[]>([]);
  const [created, setCreated] = useState<RedeemCodeDto[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [permanent, setPermanent] = useState(false);
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);
  const [quantity, setQuantity] = useState(1);

  const filteredCodes = useMemo(() => {
    if (sourceFilter === "user") {
      return codes.filter((c) => c.isUserGenerated);
    }
    if (sourceFilter === "admin") {
      return codes.filter((c) => !c.isUserGenerated);
    }
    return codes;
  }, [codes, sourceFilter]);

  const userGeneratedCount = useMemo(
    () => codes.filter((c) => c.isUserGenerated).length,
    [codes],
  );

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/redeem-codes");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setCodes(data.codes ?? []);
      setSelected([]);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreated([]);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/redeem-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permanent,
          days: permanent ? undefined : days,
          maxUses,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "生成失败");
        return;
      }
      setCreated(data.codes ?? []);
      Message.success(data.message || "生成成功");
      await loadCodes();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      Message.success(`已复制 ${text}`);
    } catch {
      setError("复制失败，请手动选择");
    }
  }

  async function deleteCodes(ids: number[]) {
    if (ids.length === 0) return;
    const tip =
      ids.length === 1
        ? "确定删除该兑换码？相关兑换记录也会一并删除。"
        : `确定删除选中的 ${ids.length} 个兑换码？相关兑换记录也会一并删除。`;

    Modal.confirm({
      title: "确认删除",
      content: tip,
      okButtonProps: { status: "danger" },
      onOk: async () => {
        setError("");
        setDeleting(true);
        try {
          const res = await fetch("/api/admin/redeem-codes", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ids.length === 1 ? { id: ids[0] } : { ids }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(data.error || "删除失败");
            return;
          }
          Message.success(data.message || "已删除");
          setCreated((prev) => prev.filter((c) => !ids.includes(c.id)));
          await loadCodes();
        } catch {
          setError("网络错误");
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  const columns: ColumnProps<RedeemCodeDto>[] = [
    {
      title: "兑换码",
      dataIndex: "code",
      width: 220,
      render: (code) => (
        <Button type="text" onClick={() => void copyText(code)}>
          <Typography.Text code>{code}</Typography.Text>
        </Button>
      ),
    },
    { title: "权益", dataIndex: "label", width: 120 },
    {
      title: "来源",
      width: 140,
      render: (_, c) =>
        c.isUserGenerated ? (
          <div>
            <Tag color="arcoblue">用户生成</Tag>
            {c.createdByName ? (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {c.createdByName}
                </Typography.Text>
              </div>
            ) : null}
          </div>
        ) : (
          <Tag>后台生成</Tag>
        ),
    },
    {
      title: "使用",
      width: 90,
      render: (_, c) => `${c.usedCount}/${c.maxUses}`,
    },
    {
      title: "状态",
      width: 100,
      render: (_, c) => {
        const status = codeStatus(c);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: "创建",
      width: 160,
      render: (_, c) =>
        c.createdAt ? new Date(c.createdAt).toLocaleString("zh-CN") : "—",
    },
    {
      title: "操作",
      width: 90,
      render: (_, c) => (
        <Button
          type="text"
          status="danger"
          loading={deleting}
          onClick={() => void deleteCodes([c.id])}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="生成兑换码">
        <Typography.Paragraph type="secondary">
          生成会员兑换码。使用次数设为 1 即为一次性兑换码。
        </Typography.Paragraph>
        <form onSubmit={onSubmit}>
          <Form layout="vertical" style={{ maxWidth: 480 }}>
            <Form.Item label="会员时长">
              <Radio.Group
                value={permanent ? "permanent" : "days"}
                onChange={(v) => setPermanent(v === "permanent")}
              >
                <Radio value="days">按天数</Radio>
                <Radio value="permanent">永久会员</Radio>
              </Radio.Group>
            </Form.Item>
            {!permanent ? (
              <Form.Item label="天数">
                <InputNumber
                  min={1}
                  max={36500}
                  value={days}
                  onChange={(v) => setDays(Number(v) || 1)}
                  style={{ width: 160 }}
                />
              </Form.Item>
            ) : null}
            <Form.Item
              label="使用次数"
              extra="1 = 一次性；同一用户仍只能兑一次"
            >
              <InputNumber
                min={1}
                max={10000}
                value={maxUses}
                onChange={(v) => setMaxUses(Number(v) || 1)}
                style={{ width: 160 }}
              />
            </Form.Item>
            <Form.Item label="生成数量">
              <InputNumber
                min={1}
                max={50}
                value={quantity}
                onChange={(v) => setQuantity(Number(v) || 1)}
                style={{ width: 160 }}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>
              生成兑换码
            </Button>
          </Form>
        </form>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {created.length > 0 ? (
        <Card
          title={`本次生成（${created.length}）`}
          extra={
            <Button
              type="primary"
              onClick={() => {
                void (async () => {
                  const text = created.map((c) => c.code).join("\n");
                  try {
                    await navigator.clipboard.writeText(text);
                    Message.success(`已批量复制 ${created.length} 个兑换码`);
                  } catch {
                    setError("复制失败，请手动选择");
                  }
                })();
              }}
            >
              批量复制全部
            </Button>
          }
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            {created.map((c) => (
              <Space
                key={c.id}
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <div>
                  <Typography.Text code>{c.code}</Typography.Text>
                  <div>
                    <Typography.Text type="secondary">
                      {c.label} · 可用 {c.maxUses} 次
                    </Typography.Text>
                  </div>
                </div>
                <Button size="small" onClick={() => void copyText(c.code)}>
                  复制
                </Button>
              </Space>
            ))}
          </Space>
        </Card>
      ) : null}

      <Card
        title={`全部兑换码（共 ${codes.length} · 用户生成 ${userGeneratedCount}）`}
        extra={
          <Space>
            <Select
              value={sourceFilter}
              onChange={(v) => {
                setSourceFilter(v as SourceFilter);
                setSelected([]);
              }}
              style={{ width: 140 }}
              options={[
                { label: "全部", value: "all" },
                { label: "用户生成", value: "user" },
                { label: "后台生成", value: "admin" },
              ]}
            />
            <Button onClick={() => void loadCodes()} loading={loading}>
              刷新
            </Button>
            <Button
              status="danger"
              disabled={selected.length === 0}
              loading={deleting}
              onClick={() => void deleteCodes(selected)}
            >
              删除选中 ({selected.length})
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={filteredCodes}
          pagination={{ pageSize: 20, showTotal: true }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as number[]),
            checkboxProps: () => ({}),
            checkAll: true,
            checkCrossPage: false,
          }}
          scroll={{ x: 900 }}
        />
      </Card>
    </Space>
  );
}
