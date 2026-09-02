"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Tag,
  Typography,
} from "@arco-design/web-react";
import type { NotificationAppTarget, NotificationType } from "@/lib/notifications";
import { clientAppLabel, clientAppTagColor } from "@/lib/client-app";

type NotificationDto = {
  id: number;
  type: NotificationType;
  appId: NotificationAppTarget;
  userId: number | null;
  username: string | null;
  nickname: string | null;
  version: string | null;
  title: string;
  summary: string;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string | null;
};

type Audience = "broadcast" | "user";

const TYPE_LABEL: Record<NotificationType, string> = {
  update: "更新通知",
  message: "消息通知",
};

export function NotificationsAdmin() {
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<NotificationType>("update");
  const [appId, setAppId] = useState<NotificationAppTarget>("all");
  const [audience, setAudience] = useState<Audience>("broadcast");
  const [targetUser, setTargetUser] = useState("");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setNotifications(data.notifications ?? []);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const user = searchParams.get("user")?.trim();
    if (!user) return;
    setAudience("user");
    setTargetUser(user);
    setAppId("hamster");
    setType("message");
  }, [searchParams]);

  async function publishNotification() {
    setError("");
    if (audience === "user" && !targetUser.trim()) {
      setError("请填写要发送的用户名或用户 ID");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: audience === "user" ? "message" : type,
          appId: audience === "user" ? "hamster" : appId,
          targetUser: audience === "user" ? targetUser.trim() : null,
          version: type === "update" && audience === "broadcast" ? version : null,
          title,
          summary,
          imageUrl,
          linkUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "发布失败");
        return;
      }
      Message.success(data.message || "发布成功");
      setVersion("");
      setTitle("");
      setSummary("");
      setImageUrl("");
      setLinkUrl("");
      await loadNotifications();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  function onDelete(id: number) {
    Modal.confirm({
      title: "确认删除",
      content: "确定删除该通知？",
      okButtonProps: { status: "danger" },
      onOk: async () => {
        setError("");
        setDeletingId(id);
        try {
          const res = await fetch("/api/admin/notifications", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(data.error || "删除失败");
            return;
          }
          Message.success(data.message || "已删除");
          await loadNotifications();
        } catch {
          setError("网络错误");
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="发布通知">
        <Typography.Paragraph type="secondary">
          广播通知可发给敲敲英语、仓鼠单词或两边都发；公开接口对敲敲英语仍只返回各类型最新一条。
          指定用户仅支持仓鼠单词，会出现在该用户的消息列表里，敲敲英语看不到。
        </Typography.Paragraph>
        <Form
          layout="vertical"
          style={{ maxWidth: 560 }}
          onSubmit={() => {
            void publishNotification();
          }}
        >
          <Form.Item label="发送范围">
            <Radio.Group
              value={audience}
              onChange={(v) => {
                const next = v as Audience;
                setAudience(next);
                if (next === "user") {
                  setType("message");
                  setAppId("hamster");
                }
              }}
            >
              <Radio value="broadcast">广播</Radio>
              <Radio value="user">指定用户（仅仓鼠单词）</Radio>
            </Radio.Group>
          </Form.Item>
          {audience === "user" ? (
            <Form.Item label="用户名或用户 ID" required>
              <Input
                value={targetUser}
                onChange={setTargetUser}
                placeholder="例如 hamster_user 或 128"
                maxLength={32}
                required
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item label="通知类型">
                <Radio.Group
                  value={type}
                  onChange={(v) => setType(v as NotificationType)}
                >
                  <Radio value="update">更新通知</Radio>
                  <Radio value="message">消息通知</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="发送给">
                <Radio.Group
                  value={appId}
                  onChange={(v) => setAppId(v as NotificationAppTarget)}
                >
                  <Radio value="all">两个 App</Radio>
                  <Radio value="qiaoqiao">仅敲敲英语</Radio>
                  <Radio value="hamster">仅仓鼠单词</Radio>
                </Radio.Group>
              </Form.Item>
              {type === "update" ? (
                <Form.Item label="版本号" required>
                  <Input
                    value={version}
                    onChange={setVersion}
                    placeholder="例如 1.2.0"
                    maxLength={64}
                    required
                  />
                </Form.Item>
              ) : null}
            </>
          )}
          <Form.Item label="标题" required>
            <Input
              value={title}
              onChange={setTitle}
              maxLength={200}
              required
            />
          </Form.Item>
          <Form.Item label="简介" required>
            <Input.TextArea
              value={summary}
              onChange={setSummary}
              maxLength={500}
              autoSize={{ minRows: 3, maxRows: 6 }}
              required
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
          <Button type="primary" htmlType="submit" loading={busy}>
            {audience === "user" ? "发给该用户" : "发布通知"}
          </Button>
        </Form>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card
        title={`全部通知（${notifications.length}）`}
        extra={
          <Button onClick={() => void loadNotifications()} loading={loading}>
            刷新
          </Button>
        }
      >
        {!loading && notifications.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <Space direction="vertical" size="medium" style={{ width: "100%" }}>
            {notifications.map((n) => (
              <Card key={n.id} size="small">
                <Space
                  align="start"
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Space align="start" size="medium">
                    {n.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={n.imageUrl}
                        alt=""
                        style={{
                          width: 112,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 8,
                          background: "var(--color-fill-2)",
                        }}
                      />
                    ) : null}
                    <div>
                      <Space wrap>
                        <Tag color={n.type === "update" ? "arcoblue" : "green"}>
                          {TYPE_LABEL[n.type]}
                        </Tag>
                        <Tag color={clientAppTagColor(n.appId)}>
                          {clientAppLabel(n.appId)}
                        </Tag>
                        {n.userId ? (
                          <Tag color="purple">
                            @{n.username || n.userId}
                            {n.nickname ? ` · ${n.nickname}` : ""}
                          </Tag>
                        ) : (
                          <Tag>广播</Tag>
                        )}
                        {n.version ? (
                          <Typography.Text type="secondary">
                            {n.version}
                          </Typography.Text>
                        ) : null}
                        {n.createdAt ? (
                          <Typography.Text type="secondary">
                            {new Date(n.createdAt).toLocaleString("zh-CN")}
                          </Typography.Text>
                        ) : null}
                      </Space>
                      <Typography.Title heading={6} style={{ margin: "8px 0" }}>
                        {n.title}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary">
                        {n.summary}
                      </Typography.Paragraph>
                      {n.linkUrl ? (
                        <Typography.Text>
                          <a href={n.linkUrl} target="_blank" rel="noreferrer">
                            {n.linkUrl}
                          </a>
                        </Typography.Text>
                      ) : null}
                    </div>
                  </Space>
                  <Button
                    type="text"
                    status="danger"
                    loading={deletingId === n.id}
                    onClick={() => onDelete(n.id)}
                  >
                    删除
                  </Button>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
