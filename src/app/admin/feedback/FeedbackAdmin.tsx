"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Message,
  Radio,
  Space,
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { ClientAppId } from "@/lib/client-app";
import { clientAppLabel, clientAppTagColor } from "@/lib/client-app";

type FeedbackType = "problem" | "promo";

type FeedbackSubmissionDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  type: FeedbackType;
  appId: ClientAppId;
  wechat: string;
  content: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string | null;
};

const TYPE_LABEL: Record<FeedbackType, { text: string; color: string }> = {
  problem: { text: "问题反馈", color: "orangered" },
  promo: { text: "推广合作", color: "arcoblue" },
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function FeedbackAdmin() {
  const [appFilter, setAppFilter] = useState<"all" | ClientAppId>("all");
  const [submissions, setSubmissions] = useState<FeedbackSubmissionDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      const list = (data.submissions ?? []) as FeedbackSubmissionDto[];
      setSubmissions(list);
      setDrafts((prev) => {
        const next: Record<number, string> = {};
        for (const item of list) {
          next[item.id] = prev[item.id] ?? item.adminReply ?? "";
        }
        return next;
      });
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const onReply = async (id: number) => {
    const reply = (drafts[id] ?? "").trim();
    if (!reply) {
      Message.warning("请填写回复内容");
      return;
    }
    setReplyingId(id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", id, reply }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        Message.error(data.error || "回复失败");
        return;
      }
      const updated = data.submission as FeedbackSubmissionDto;
      setSubmissions((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      setDrafts((prev) => ({ ...prev, [id]: updated.adminReply ?? "" }));
      Message.success(data.message || "已回复");
    } finally {
      setReplyingId(null);
    }
  };

  const visible = useMemo(() => {
    if (appFilter === "all") return submissions;
    return submissions.filter((item) => item.appId === appFilter);
  }, [appFilter, submissions]);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="反馈合作"
        extra={
          <Button onClick={() => void loadSubmissions()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          共 {submissions.length} 条
          {appFilter === "all"
            ? ""
            : ` · 当前显示 ${visible.length} 条`}{" "}
          · 新提交会同步 Bark 推送 · 回复后用户可在 App 历史反馈中查看
        </Typography.Paragraph>
        <Radio.Group
          type="button"
          value={appFilter}
          onChange={(value) => setAppFilter(value as "all" | ClientAppId)}
        >
          <Radio value="all">全部应用</Radio>
          <Radio value="qiaoqiao">敲敲英语</Radio>
          <Radio value="hamster">仓鼠单词</Radio>
        </Radio.Group>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {!loading && visible.length === 0 ? (
        <Empty description="还没有反馈记录" />
      ) : (
        <Space direction="vertical" size="medium" style={{ width: "100%" }}>
          {visible.map((item) => {
            const typeMeta = TYPE_LABEL[item.type];
            const displayName =
              item.nickname?.trim() || item.username || `用户#${item.userId}`;
            const hasReply = Boolean(item.adminReply);
            return (
              <Card key={item.id} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space>
                    <Tag color={typeMeta.color}>{typeMeta.text}</Tag>
                    <Tag color={clientAppTagColor(item.appId)}>
                      {clientAppLabel(item.appId)}
                    </Tag>
                    {hasReply ? (
                      <Tag color="green">已回复</Tag>
                    ) : (
                      <Tag color="gray">待回复</Tag>
                    )}
                    <Typography.Text bold>{displayName}</Typography.Text>
                    {item.username ? (
                      <Typography.Text type="secondary">
                        @{item.username}
                      </Typography.Text>
                    ) : null}
                  </Space>
                  <Typography.Text type="secondary">
                    {formatTime(item.createdAt)}
                  </Typography.Text>
                </Space>
                <Typography.Paragraph style={{ marginTop: 12, marginBottom: 8 }}>
                  <Typography.Text type="secondary">微信：</Typography.Text>
                  {item.wechat}
                </Typography.Paragraph>
                <Typography.Paragraph
                  style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}
                >
                  {item.content}
                </Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  官方回复
                  {item.repliedAt ? ` · ${formatTime(item.repliedAt)}` : ""}
                </Typography.Text>
                <Input.TextArea
                  value={drafts[item.id] ?? ""}
                  onChange={(value) =>
                    setDrafts((prev) => ({ ...prev, [item.id]: value }))
                  }
                  placeholder="填写回复内容，用户可在 App 历史反馈中看到"
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  maxLength={2000}
                  style={{ marginTop: 8 }}
                />
                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <Button
                    type="primary"
                    loading={replyingId === item.id}
                    onClick={() => void onReply(item.id)}
                  >
                    {hasReply ? "更新回复" : "发送回复"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </Space>
      )}
    </Space>
  );
}
