"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
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
  const [grantCount, setGrantCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [summaryJa, setSummaryJa] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);

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
      setGrantCount(Number(data.grantCount ?? data.grants?.length ?? 0));
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

  function resetNotifyForm() {
    setTitle("");
    setSummary("");
    setTitleJa("");
    setSummaryJa("");
    setImageUrl("");
    setLinkUrl("");
  }

  function onNotifySubmit() {
    if (!title.trim() || !summary.trim()) {
      setError("请填写中文标题和简介");
      return;
    }
    if (grantCount <= 0) {
      setError("暂无通过爱吃领取会员的用户");
      return;
    }

    Modal.confirm({
      title: "确认群发私信",
      content: `将向全部 ${grantCount} 位通过爱吃领取会员的用户发送仓鼠单词私信，确认继续？`,
      okText: "发送",
      onOk: async () => {
        setSending(true);
        setError("");
        try {
          const res = await fetch("/api/admin/aichi-vip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "notifyGrantees",
              title: title.trim(),
              summary: summary.trim(),
              titleJa: titleJa.trim() || null,
              summaryJa: summaryJa.trim() || null,
              imageUrl: imageUrl.trim() || null,
              linkUrl: linkUrl.trim() || null,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(data.error || "发送失败");
            return;
          }
          Message.success(data.message || "已发送");
          resetNotifyForm();
        } catch {
          setError("网络错误");
        } finally {
          setSending(false);
        }
      },
    });
  }

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

      <Card title={`群发私信（仓鼠单词 · 共 ${grantCount} 人）`}>
        <Typography.Paragraph type="secondary">
          向全部通过爱吃领取会员的用户发送个人消息通知。用户打开仓鼠单词通知列表即可看到。
        </Typography.Paragraph>
        <Form
          layout="vertical"
          style={{ maxWidth: 640 }}
          onSubmit={() => {
            onNotifySubmit();
          }}
        >
          <Form.Item label="中文标题" required>
            <Input
              value={title}
              onChange={setTitle}
              maxLength={200}
              placeholder="简体中文"
              required
            />
          </Form.Item>
          <Form.Item label="中文简介" required>
            <Input.TextArea
              value={summary}
              onChange={setSummary}
              maxLength={500}
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder="简体中文"
              required
            />
          </Form.Item>
          <Form.Item label="日文标题（可选）">
            <Input
              value={titleJa}
              onChange={setTitleJa}
              maxLength={200}
              placeholder="日本語"
            />
          </Form.Item>
          <Form.Item label="日文简介（可选）">
            <Input.TextArea
              value={summaryJa}
              onChange={setSummaryJa}
              maxLength={500}
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder="日本語"
            />
          </Form.Item>
          <Form.Item label="图片链接（可选）">
            <Input
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://"
              maxLength={500}
            />
          </Form.Item>
          <Form.Item label="跳转链接（可选）">
            <Input
              value={linkUrl}
              onChange={setLinkUrl}
              placeholder="https://"
              maxLength={500}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={sending}
            disabled={grantCount <= 0}
          >
            发给全部爱吃领会员用户
          </Button>
        </Form>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card title={`最近发放（${grants.length}${grantCount > grants.length ? ` / 共 ${grantCount}` : ""}）`}>
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
