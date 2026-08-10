import {
  ALIPAY_MSG_DEPOSITBACK_COMPLETED,
  getAlipayAppId,
  verifyAlipayNotify,
} from "@/lib/alipay";

function plain(body: "success" | "fail") {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function parseNotifyParams(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";
  const params: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        params[key] = String(value);
      }
    }
    return params;
  }

  const form = await req.formData();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}

type DepositbackBiz = {
  trade_no?: string;
  out_trade_no?: string;
  out_request_no?: string;
  dback_status?: string;
  dback_amount?: string;
  bank_ack_time?: string;
  est_bank_receipt_time?: string;
};

function parseBizContent(raw: string | undefined): DepositbackBiz | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DepositbackBiz;
  } catch {
    return null;
  }
}

/**
 * Alipay 应用网关（From 蚂蚁 HTTP）。
 * 开放平台「应用网关」填 ALIPAY_APP_GATEWAY_URL，并订阅对应消息。
 * @see https://opendocs.alipay.com/solution/e2a7e429_alipay.trade.refund.depositback.completed
 */
export async function POST(req: Request) {
  try {
    const params = await parseNotifyParams(req);

    if (!verifyAlipayNotify(params)) {
      console.error(
        "[alipay/gateway] invalid signature",
        params.msg_method,
        params.notify_id,
      );
      return plain("fail");
    }

    const appId = params.app_id;
    if (appId && appId !== getAlipayAppId()) {
      console.error("[alipay/gateway] app_id mismatch", appId);
      return plain("fail");
    }

    const msgMethod = params.msg_method;

    if (msgMethod === ALIPAY_MSG_DEPOSITBACK_COMPLETED) {
      const biz = parseBizContent(params.biz_content);
      if (!biz?.out_trade_no || !biz.trade_no || !biz.out_request_no) {
        console.error("[alipay/gateway] depositback missing fields", params);
        return plain("fail");
      }

      console.info("[alipay/gateway] depositback.completed", {
        outTradeNo: biz.out_trade_no,
        tradeNo: biz.trade_no,
        outRequestNo: biz.out_request_no,
        dbackStatus: biz.dback_status,
        dbackAmount: biz.dback_amount,
        bankAckTime: biz.bank_ack_time,
        estBankReceiptTime: biz.est_bank_receipt_time,
      });

      return plain("success");
    }

    // 未处理的消息类型：确认成功，避免无意义重试
    console.info("[alipay/gateway] unhandled msg_method", msgMethod);
    return plain("success");
  } catch (err) {
    console.error("[alipay/gateway]", err);
    return plain("fail");
  }
}
