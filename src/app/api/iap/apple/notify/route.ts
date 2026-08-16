import { jsonError, jsonOk } from "@/lib/api";
import {
  clawbackAppleRefundDiamonds,
  fulfillAppleNotificationTx,
} from "@/lib/apple-fulfill";
import { verifyAppleNotification } from "@/lib/apple-jws";

export const dynamic = "force-dynamic";

const GRANT_TYPES = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "OFFER_REDEEMED",
  "ONE_TIME_CHARGE",
]);

const REFUND_TYPES = new Set(["REFUND"]);

/**
 * App Store Server Notifications V2.
 * Configure this URL in App Store Connect → App → App Store Server Notifications.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { signedPayload?: string };
    const signedPayload = body.signedPayload?.trim();
    if (!signedPayload) {
      return jsonError("缺少 signedPayload", 400);
    }

    const { notification, transaction } =
      await verifyAppleNotification(signedPayload);
    const type = String(notification.notificationType || "");

    if (transaction && REFUND_TYPES.has(type)) {
      try {
        const result = await clawbackAppleRefundDiamonds(transaction);
        return jsonOk({
          notificationType: type,
          processed: !result.alreadyProcessed,
          alreadyProcessed: result.alreadyProcessed,
          diamondsClawed: result.diamondsClawed,
          transactionId: transaction.transactionId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "退款处理失败";
        console.error("[apple/notify] refund", message);
        return jsonOk({
          ignored: true,
          notificationType: type,
          error: message,
        });
      }
    }

    if (!transaction || !GRANT_TYPES.has(type) || transaction.revocationDate) {
      return jsonOk({
        ignored: true,
        notificationType: type,
      });
    }

    try {
      const result = await fulfillAppleNotificationTx(transaction);
      return jsonOk({
        notificationType: type,
        processed: Boolean(result),
        alreadyProcessed: result?.alreadyProcessed ?? false,
        transactionId: transaction.transactionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "通知处理失败";
      console.error("[iap/apple/notify] fulfill", message);
      return jsonOk({
        ignored: true,
        notificationType: type,
        error: message,
      });
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error("[iap/apple/notify]", err.message);
      return jsonError(err.message, 400);
    }
    console.error(err);
    return jsonError("通知处理失败", 500);
  }
}

