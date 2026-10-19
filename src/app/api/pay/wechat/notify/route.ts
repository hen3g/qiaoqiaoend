import {
  decryptWechatResource,
  fenToYuanString,
  getWechatPayAppId,
  isWechatPayConfigured,
  isWechatTradeSuccess,
  verifyWechatPaySignature,
  type WechatNotifyResource,
} from "@/lib/wechat-pay";
import { markOrderPaidAndFulfill } from "@/lib/payment-orders";

function jsonReply(code: "SUCCESS" | "FAIL", message: string) {
  return Response.json(
    { code, message },
    {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}

/**
 * WeChat Pay APIv3 async notify.
 * @see https://pay.weixin.qq.com/doc/v3/merchant/4012791861
 */
export async function POST(req: Request) {
  if (!isWechatPayConfigured()) {
    console.error("[wechat/notify] not configured");
    return jsonReply("FAIL", "未配置微信支付");
  }

  try {
    const body = await req.text();
    const timestamp = req.headers.get("wechatpay-timestamp") || "";
    const nonce = req.headers.get("wechatpay-nonce") || "";
    const signature = req.headers.get("wechatpay-signature") || "";
    const serial = req.headers.get("wechatpay-serial") || "";

    const ok = await verifyWechatPaySignature({
      timestamp,
      nonce,
      body,
      signature,
      serial,
    });
    if (!ok) {
      console.error("[wechat/notify] invalid signature");
      return jsonReply("FAIL", "签名验证失败");
    }

    let envelope: {
      id?: string;
      create_time?: string;
      event_type?: string;
      resource_type?: string;
      resource?: {
        algorithm?: string;
        ciphertext: string;
        associated_data?: string;
        nonce: string;
        original_type?: string;
      };
    };
    try {
      envelope = JSON.parse(body) as typeof envelope;
    } catch {
      return jsonReply("FAIL", "正文无效");
    }

    if (!envelope.resource) {
      console.error("[wechat/notify] missing resource");
      return jsonReply("FAIL", "缺少 resource");
    }

    // Non-payment events: acknowledge
    if (
      envelope.event_type &&
      envelope.event_type !== "TRANSACTION.SUCCESS"
    ) {
      console.info("[wechat/notify] ignore event", envelope.event_type);
      return jsonReply("SUCCESS", "成功");
    }

    let resource: WechatNotifyResource;
    try {
      const plain = decryptWechatResource(envelope.resource);
      resource = JSON.parse(plain) as WechatNotifyResource;
    } catch (err) {
      console.error("[wechat/notify] decrypt failed", err);
      return jsonReply("FAIL", "解密失败");
    }

    if (!isWechatTradeSuccess(resource.trade_state)) {
      return jsonReply("SUCCESS", "成功");
    }

    const outTradeNo = resource.out_trade_no?.trim();
    const transactionId = resource.transaction_id?.trim();
    const appId = resource.appid?.trim();
    const totalFen = resource.amount?.total;

    if (!outTradeNo || !transactionId || !appId || totalFen == null) {
      console.error("[wechat/notify] missing fields", {
        outTradeNo,
        hasTx: Boolean(transactionId),
        appId,
        totalFen,
      });
      return jsonReply("FAIL", "字段缺失");
    }

    const expectedAppId = getWechatPayAppId();
    await markOrderPaidAndFulfill({
      outTradeNo,
      alipayTradeNo: transactionId,
      totalAmountYuan: fenToYuanString(Number(totalFen)),
      appId,
      expectedAppId,
      channel: "微信支付",
    });

    return jsonReply("SUCCESS", "成功");
  } catch (err) {
    console.error("[wechat/notify]", err);
    return jsonReply("FAIL", "处理失败");
  }
}
