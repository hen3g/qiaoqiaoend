"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Message,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "@arco-design/web-react";

type Setting = {
  enabled: boolean;
  updatedAt: string | null;
  source: "db" | "default";
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function WechatLoginAdmin() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hamster/wechat-login");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setSetting(data.setting as Setting);
      setError("");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggle(next: boolean) {
    setError("");
    setToggling(true);
    try {
      const res = await fetch("/api/admin/hamster/wechat-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "保存失败");
        return;
      }
      setSetting(data.setting as Setting);
      Message.success(data.message || "已保存");
    } catch {
      setError("网络错误");
    } finally {
      setToggling(false);
    }
  }

  const enabled = setting?.enabled ?? true;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title="微信登录显示"
        extra={
          <Button onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary">
          控制仓鼠单词（app2）安卓端登录页「微信登录」按钮，以及「我的 → 绑定微信」入口。关闭后客户端会完全隐藏；仅安卓生效，iOS 本来就不显示。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          公开接口：<code>GET /api/auth/wechat/config</code>
          。未写入数据库时默认开启。客户端拉取失败时隐藏按钮（商店更安全）。修改后需已部署的后端才会生效。
        </Typography.Paragraph>

        {error ? (
          <Alert
            type="error"
            content={error}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError("")}
          />
        ) : null}

        {loading && !setting ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <Spin />
          </div>
        ) : (
          <>
            <Space align="center" style={{ marginBottom: 12 }}>
              <Typography.Text>显示微信登录</Typography.Text>
              <Switch
                checked={enabled}
                loading={toggling}
                onChange={(v) => void onToggle(v)}
              />
              <Tag color={enabled ? "green" : "gray"}>
                {enabled ? "已开启" : "已关闭"}
              </Tag>
            </Space>
            <Typography.Paragraph type="secondary">
              来源：{setting?.source === "db" ? "数据库" : "默认值"} · 更新时间：
              {formatTime(setting?.updatedAt ?? null)}
            </Typography.Paragraph>
          </>
        )}
      </Card>
    </Space>
  );
}
