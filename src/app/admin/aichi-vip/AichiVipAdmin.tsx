"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Message,
} from "@arco-design/web-react";

type GrantRow = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string;
  source: string;
  daysGranted: number;
  createdAt: string | null;
};

type RuleInfo = {
  field: string;
  prefix: string;
  minExtraChars: number;
  days: number;
  years: number;
  skipIfAlreadyVip: boolean;
  oncePerUser: boolean;
  triggers: string[];
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

const SOURCE_LABEL: Record<string, string> = {
  register: "注册",
  rename: "改名",
};

export function AichiVipAdmin() {
  const [enabled, setEnabled] = useState(true);
  const [rule, setRule] = useState<RuleInfo | null>(null);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/aichi-vip");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setEnabled(Boolean(data.settings?.enabled));
      setRule(data.rule ?? null);
      setGrants((data.grants ?? []) as GrantRow[]);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (next: boolean) => {
    setToggling(true);
    try {
      const res = await fetch("/api/admin/aichi-vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setEnabled", enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        Message.error(data.error || "更新失败");
        return;
      }
      setEnabled(Boolean(data.settings?.enabled));
      Message.success(data.message || "已更新");
    } finally {
      setToggling(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="爱吃昵称 VIP"
        extra={
          <Button onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Space align="center" style={{ marginBottom: 16 }}>
          <Typography.Text>活动开关</Typography.Text>
          <Switch
            checked={enabled}
            loading={toggling}
            onChange={(v) => void onToggle(v)}
          />
          <Tag color={enabled ? "green" : "gray"}>
            {enabled ? "已开启" : "已关闭"}
          </Tag>
        </Space>

        <Typography.Paragraph>
          用户将<strong>昵称</strong>设为以「{rule?.prefix ?? "爱吃"}」开头，且前缀后再至少有{" "}
          {rule?.minExtraChars ?? 2} 个字符时，自动发放{" "}
          {rule?.years ?? 99} 年 VIP（{rule?.days ?? 99 * 365} 天，走现有{" "}
          <code>extendVip</code>）。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          触发：注册写入初始昵称、以及改名接口成功后。已是 VIP / 已领过本活动的用户不会重复发放。
          检查字段为 nickname（用户名 username 为字母数字下划线，无法匹配中文前缀）。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          示例：匹配「爱吃你好」「爱吃AB」；不匹配「爱吃」「爱吃A」「吃爱你好」。
        </Typography.Paragraph>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card title={`最近发放（${grants.length}）`}>
        {!loading && grants.length === 0 ? (
          <Empty description="还没有发放记录" />
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            pagination={false}
            data={grants}
            columns={[
              {
                title: "用户",
                dataIndex: "nickname",
                render: (_: unknown, row: GrantRow) => (
                  <Space>
                    <Typography.Text bold>{row.nickname}</Typography.Text>
                    {row.username ? (
                      <Typography.Text type="secondary">
                        @{row.username}
                      </Typography.Text>
                    ) : null}
                    <Typography.Text type="secondary">
                      #{row.userId}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: "来源",
                dataIndex: "source",
                width: 100,
                render: (source: string) => (
                  <Tag>{SOURCE_LABEL[source] ?? source}</Tag>
                ),
              },
              {
                title: "天数",
                dataIndex: "daysGranted",
                width: 100,
              },
              {
                title: "时间",
                dataIndex: "createdAt",
                width: 180,
                render: (v: string | null) => formatTime(v),
              },
            ]}
          />
        )}
      </Card>
    </Space>
  );
}
