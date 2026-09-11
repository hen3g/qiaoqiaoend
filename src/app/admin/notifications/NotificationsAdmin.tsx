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
import type { ClientAppId } from "@/lib/client-app";
import { CLIENT_APP_LABELS } from "@/lib/client-app";
import type { NotificationType } from "@/lib/notifications";

type AudienceLocale = "all" | "zh" | "ja";
type Audience = "broadcast" | "user";

type NotificationDto = {
  id: number;
  type: NotificationType;
  appId: string;
  userId: number | null;
  username: string | null;
  nickname: string | null;
  version: string | null;
  title: string;
  summary: string;
  titleZh: string | null;
  summaryZh: string | null;
  titleJa: string | null;
  summaryJa: string | null;
  locale: "zh" | "ja" | null;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string | null;
};

const TYPE_LABEL: Record<NotificationType, string> = {
  update: "更新通知",
  message: "消息通知",
};

export function NotificationsAdmin({
  app,
}: {
  app: ClientAppId;
}) {
  const searchParams = useSearchParams();
  const isHamster = app === "hamster";
  const appLabel = CLIENT_APP_LABELS[app];

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<NotificationType>("update");
  const [audience, setAudience] = useState<Audience>("broadcast");
  const [audienceLocale, setAudienceLocale] = useState<AudienceLocale>("all");
  const [targetUser, setTargetUser] = useState("");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [summaryJa, setSummaryJa] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?app=${app}`);
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
  }, [app]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!isHamster) return;
    const user = searchParams.get("user")?.trim();
    if (!user) return;
    setAudience("user");
    setTargetUser(user);
    setType("message");
  }, [searchParams, isHamster]);

  function resetForm() {
    setVersion("");
    setTitle("");
    setSummary("");
    setTitleJa("");
    setSummaryJa("");
    setImageUrl("");
    setLinkUrl("");
  }

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
          appId: app,
          ...(audience === "user"
            ? { targetUser: targetUser.trim() }
            : isHamster && audienceLocale !== "all"
              ? { locale: audienceLocale }
              : { locale: null }),
          version: type === "update" && audience === "broadcast" ? version : null,
          title,
          summary,
          ...(isHamster
            ? { titleJa, summaryJa }
            : { titleJa: null, summaryJa: null }),
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
      resetForm();
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
      <Card title={`${appLabel} · 发布通知`}>
        <Typography.Paragraph type="secondary">
          {isHamster
            ? "仓鼠单词专用推送。广播可按语言受众筛选；填写中/日文案后，用户按自身操作语言看到对应内容。指定用户不限制语言，始终送达，文案优先用用户 locale。"
            : "敲敲英语专用推送（中文）。不会发到仓鼠单词设备/列表。"}
        </Typography.Paragraph>
        <Form
          layout="vertical"
          style={{ maxWidth: 640 }}
          onSubmit={() => {
            void publishNotification();
          }}
        >
          {isHamster ? (
            <Form.Item label="发送范围">
              <Radio.Group
                value={audience}
                onChange={(v) => {
                  const next = v as Audience;
                  setAudience(next);
                  if (next === "user") {
                    setType("message");
                    setAudienceLocale("all");
                  }
                }}
              >
                <Radio value="broadcast">广播</Radio>
                <Radio value="user">指定用户</Radio>
              </Radio.Group>
            </Form.Item>
          ) : null}

          {isHamster && audience === "user" ? (
            <Form.Item label="用户名或用户 ID（可多个，逗号/换行分隔）" required>
              <Input.TextArea
                value={targetUser}
                onChange={setTargetUser}
                placeholder={"例如 hamster_user 或 128\n也可一次填多个"}
                maxLength={500}
                autoSize={{ minRows: 2, maxRows: 5 }}
                required
              />
            </Form.Item>
          ) : null}

          {audience === "broadcast" ? (
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
              {isHamster ? (
                <Form.Item label="语言受众">
                  <Radio.Group
                    value={audienceLocale}
                    onChange={(v) => setAudienceLocale(v as AudienceLocale)}
                  >
                    <Radio value="all">全部仓鼠用户</Radio>
                    <Radio value="zh">仅中文</Radio>
                    <Radio value="ja">仅日文</Radio>
                  </Radio.Group>
                </Form.Item>
              ) : null}
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
          ) : null}

          {isHamster ? (
            <>
              {(audience === "user" ||
                audienceLocale === "all" ||
                audienceLocale === "zh") && (
                <>
                  <Form.Item
                    label="中文标题"
                    required={
                      audience === "user" ||
                      audienceLocale === "all" ||
                      audienceLocale === "zh"
                    }
                  >
                    <Input
                      value={title}
                      onChange={setTitle}
                      maxLength={200}
                      placeholder="简体中文"
                    />
                  </Form.Item>
                  <Form.Item label="中文简介" required={audienceLocale !== "ja"}>
                    <Input.TextArea
                      value={summary}
                      onChange={setSummary}
                      maxLength={500}
                      autoSize={{ minRows: 3, maxRows: 6 }}
                      placeholder="简体中文"
                    />
                  </Form.Item>
                </>
              )}
              {(audience === "user" ||
                audienceLocale === "all" ||
                audienceLocale === "ja") && (
                <>
                  <Form.Item
                    label="日文标题"
                    required={audienceLocale === "ja"}
                  >
                    <Input
                      value={titleJa}
                      onChange={setTitleJa}
                      maxLength={200}
                      placeholder="日本語"
                    />
                  </Form.Item>
                  <Form.Item
                    label="日文简介"
                    required={audienceLocale === "ja"}
                  >
                    <Input.TextArea
                      value={summaryJa}
                      onChange={setSummaryJa}
                      maxLength={500}
                      autoSize={{ minRows: 3, maxRows: 6 }}
                      placeholder="日本語"
                    />
                  </Form.Item>
                </>
              )}
            </>
          ) : (
            <>
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
            </>
          )}

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
            {audience === "user" ? "发给指定用户" : "发布通知"}
          </Button>
        </Form>
      </Card>

      {error ? <Alert type="error" content={error} /> : null}

      <Card
        title={`${appLabel}通知（${notifications.length}）`}
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
                        {n.appId === "all" ? (
                          <Tag color="gray">历史·双端</Tag>
                        ) : null}
                        {n.userId ? (
                          <Tag color="purple">
                            @{n.username || n.userId}
                            {n.nickname ? ` · ${n.nickname}` : ""}
                          </Tag>
                        ) : n.locale === "zh" ? (
                          <Tag color="blue">受众·中文</Tag>
                        ) : n.locale === "ja" ? (
                          <Tag color="magenta">受众·日文</Tag>
                        ) : (
                          <Tag>广播·全部语言</Tag>
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
                      {n.titleZh || n.summaryZh ? (
                        <>
                          <Typography.Title
                            heading={6}
                            style={{ margin: "8px 0 4px" }}
                          >
                            {n.titleZh || n.title}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary">
                            {n.summaryZh || n.summary}
                          </Typography.Paragraph>
                        </>
                      ) : null}
                      {n.titleJa || n.summaryJa ? (
                        <>
                          <Typography.Text type="secondary">日本語</Typography.Text>
                          <Typography.Title
                            heading={6}
                            style={{ margin: "4px 0" }}
                          >
                            {n.titleJa}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary">
                            {n.summaryJa}
                          </Typography.Paragraph>
                        </>
                      ) : null}
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
