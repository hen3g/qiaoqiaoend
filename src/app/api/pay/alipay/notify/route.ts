import {
  isAlipayTradeSuccess,
  resolveAlipayMerchantByAppId,
  verifyAlipayNotify,
} from "@/lib/alipay";
import { markOrderPaidAndFulfill } from "@/lib/payment-orders";

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

  // Alipay sends application/x-www-form-urlencoded; prefer text+URLSearchParams
  // over formData() for consistent string decoding.
  const raw = await req.text();
  if (raw) {
    const search = new URLSearchParams(raw);
    for (const [key, value] of search.entries()) {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Alipay async notify. Must return plain text `success` or `failure`.
 * @see https://opendocs.alipay.com/open/204/105301
 */
export async function POST(req: Request) {
  try {
    const params = await parseNotifyParams(req);

    if (!verifyAlipayNotify(params)) {
      console.error("[alipay/notify] invalid signature", params.out_trade_no);
      return new Response("failure", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (!isAlipayTradeSuccess(params.trade_status)) {
      // Not a successful trade — acknowledge so Alipay stops retrying noise
      return new Response("success", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const totalAmount = params.total_amount;
    const appId = params.app_id;

    if (!outTradeNo || !tradeNo || !totalAmount || !appId) {
      console.error("[alipay/notify] missing fields", params);
      return new Response("failure", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const merchant = resolveAlipayMerchantByAppId(appId);
    if (!merchant) {
      console.error("[alipay/notify] unknown app_id", appId);
      return new Response("failure", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    await markOrderPaidAndFulfill({
      outTradeNo,
      alipayTradeNo: tradeNo,
      totalAmountYuan: totalAmount,
      appId,
      expectedAppId: merchant.appId,
    });

    return new Response("success", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[alipay/notify]", err);
    return new Response("failure", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
