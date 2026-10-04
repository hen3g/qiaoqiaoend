import type { ClientAppId } from "@/lib/client-app";
import { clientAppLabel } from "@/lib/client-app";
import { sendFeishuText } from "@/lib/feishu";

export type PaymentNotice = {
  event: "paid" | "refunded";
  app: ClientAppId;
  channel: string;
  product: string;
  amount: string;
  userLabel: string;
  orderNo: string;
  /** Sandbox / license-test purchases. */
  test?: boolean;
  details?: string[];
};

export function formatPayUser(user: {
  id: number;
  nickname?: string | null;
  username?: string | null;
}): string {
  const name = user.nickname?.trim() || user.username?.trim() || "未命名";
  const username = user.username?.trim();
  const id = `#${user.id}`;
  if (username && username !== name) return `${name}（${username} / ${id}）`;
  return `${name}（${id}）`;
}

function shanghaiNow(): string {
  return new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

/** Notify a confirmed collection or refund. Failures never block payment. */
export async function notifyPayment(notice: PaymentNotice): Promise<void> {
  const title = notice.event === "paid" ? "收款" : "退款";
  const test = notice.test ? "·测试" : "";
  const lines = [
    `【${title}${test}】${clientAppLabel(notice.app)}`,
    `渠道：${notice.channel}`,
    `商品：${notice.product}`,
    `金额：${notice.amount}`,
    `用户：${notice.userLabel}`,
    `单号：${notice.orderNo}`,
    ...(notice.details ?? []),
    `时间：${shanghaiNow()}`,
  ];
  try {
    await sendFeishuText(lines.join("\n"));
  } catch (err) {
    console.warn("[payment-notify]", err);
  }
}
