"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Message,
  Radio,
  Space,
  Spin,
  Tag,
  Typography,
} from "@arco-design/web-react";

type AiProvider = "deepseek" | "hy3" | "hy3-deepseek";

type AiProviderOption = {
  provider: AiProvider;
  label: string;
  model: string;
  tokenConfigured: boolean;
};

type AiRuntimeStatus = {
  provider: AiProvider;
  source: "admin" | "env";
  model: string;
  tokenConfigured: boolean;
  updatedAt: string | null;
  options: AiProviderOption[];
};

export function AiModelAdmin() {
  const [status, setStatus] = useState<AiRuntimeStatus | null>(null);
  const [selected, setSelected] = useState<AiProvider>("deepseek");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-provider");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "加载失败");
        return;
      }
      const next: AiRuntimeStatus = {
        provider: data.provider,
        source: data.source,
        model: data.model,
        tokenConfigured: data.tokenConfigured,
        updatedAt: data.updatedAt,
        options: data.options ?? [],
      };
      setStatus(next);
      setSelected(next.provider);
      setError("");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "切换失败");
        return;
      }
      const next: AiRuntimeStatus = {
        provider: data.provider,
        source: data.source,
        model: data.model,
        tokenConfigured: data.tokenConfigured,
        updatedAt: data.updatedAt,
        options: data.options ?? status?.options ?? [],
      };
      setStatus(next);
      setSelected(next.provider);
      Message.success(data.message || "已切换模型");
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  const dirty = status != null && selected !== status.provider;
  const selectedOption = status?.options.find((o) => o.provider === selected);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="切换 AI 模型">
        <Typography.Paragraph type="secondary">
          用于自制课程、推荐单词。切换后立即生效，无需重启服务。未在后台指定时，沿用环境变量
          AI_PROVIDER。
        </Typography.Paragraph>

        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <Spin />
          </div>
        ) : (
          <>
            {status ? (
              <Space style={{ marginBottom: 16 }} wrap>
                <Tag color="arcoblue">当前 {status.model}</Tag>
                <Tag color={status.source === "admin" ? "green" : "gray"}>
                  {status.source === "admin" ? "后台指定" : "环境变量默认"}
                </Tag>
                {status.tokenConfigured ? (
                  <Tag color="green">Token 已配置</Tag>
                ) : (
                  <Tag color="red">Token 未配置</Tag>
                )}
                {status.updatedAt ? (
                  <Typography.Text type="secondary">
                    上次切换{" "}
                    {new Date(status.updatedAt).toLocaleString("zh-CN")}
                  </Typography.Text>
                ) : null}
              </Space>
            ) : null}

            <Radio.Group
              value={selected}
              onChange={(v) => setSelected(v as AiProvider)}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {(status?.options ?? []).map((opt) => (
                <Radio key={opt.provider} value={opt.provider}>
                  <Space>
                    <span>{opt.label}</span>
                    <Typography.Text type="secondary">
                      {opt.model}
                    </Typography.Text>
                    {opt.tokenConfigured ? (
                      <Tag size="small" color="green">
                        已配置
                      </Tag>
                    ) : (
                      <Tag size="small" color="orangered">
                        未配置 Token
                      </Tag>
                    )}
                  </Space>
                </Radio>
              ))}
            </Radio.Group>

            {selectedOption && !selectedOption.tokenConfigured ? (
              <Alert
                type="warning"
                style={{ marginTop: 16 }}
                content="该模型未配置 Token，无法切换。请先在环境变量中写入对应密钥后重启服务。"
              />
            ) : null}

            <div style={{ marginTop: 20 }}>
              <Button
                type="primary"
                loading={saving}
                disabled={!dirty || !selectedOption?.tokenConfigured}
                onClick={() => void save()}
              >
                保存并立即生效
              </Button>
            </div>
          </>
        )}
      </Card>

      {error ? <Alert type="error" content={error} /> : null}
    </Space>
  );
}
