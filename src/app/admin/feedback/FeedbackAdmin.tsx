"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Space, Tag, Typography } from "@arco-design/web-react";

type FeedbackType = "problem" | "promo";

type FeedbackSubmissionDto = {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  type: FeedbackType;
  wechat: string;
  content: string;
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
  const [submissions, setSubmissions] = useState<FeedbackSubmissionDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setSubmissions(data.submissions ?? []);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

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
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          共 {submissions.length} 条 · 新提交会同步 Bark 推送
        </Typography.Paragraph>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      {!loading && submissions.length === 0 ? (
        <Empty description="还没有反馈记录" />
      ) : (
        <Space direction="vertical" size="medium" style={{ width: "100%" }}>
          {submissions.map((item) => {
            const typeMeta = TYPE_LABEL[item.type];
            const displayName =
              item.nickname?.trim() || item.username || `用户#${item.userId}`;
            return (
              <Card key={item.id} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space>
                    <Tag color={typeMeta.color}>{typeMeta.text}</Tag>
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
                  style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}
                >
                  {item.content}
                </Typography.Paragraph>
              </Card>
            );
          })}
        </Space>
      )}
    </Space>
  );
}
