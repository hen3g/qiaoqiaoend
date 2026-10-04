import "server-only";

/**
 * Feishu custom bot.
 * Env: FEISHU_PAYMENT_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/<token>
 */
const DEFAULT_PAYMENT_WEBHOOK =
  "https://open.feishu.cn/open-apis/bot/v2/hook/3f1fa944-60ca-45bd-922f-3a11dfa9a342";

export function paymentWebhookUrl(): string {
  return (process.env.FEISHU_PAYMENT_WEBHOOK || DEFAULT_PAYMENT_WEBHOOK).trim();
}

export async function sendFeishuText(text: string): Promise<void> {
  const url = paymentWebhookUrl();
  if (!url) {
    console.warn("[feishu] webhook not set; skip");
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msg_type: "text",
      content: { text: text.slice(0, 4000) },
    }),
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`飞书通知 HTTP ${res.status} ${raw.slice(0, 200)}`);
  }
  try {
    const json = JSON.parse(raw) as { code?: number; msg?: string };
    if (typeof json.code === "number" && json.code !== 0) {
      throw new Error(`飞书通知失败 ${json.code} ${json.msg || raw.slice(0, 200)}`);
    }
  } catch (err) {
    if (err instanceof SyntaxError) return;
    throw err;
  }
}
