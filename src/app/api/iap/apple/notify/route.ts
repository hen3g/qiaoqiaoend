import { jsonError, jsonOk } from "@/lib/api";
import { fulfillAppleNotificationTx } from "@/lib/apple-fulfill";
import { verifyAppleNotification } from "@/lib/apple-jws";

export const dynamic = "force-dynamic";

const GRANT_TYPES = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "OFFER_REDEEMED",
  "DID_CHANGE_RENEWAL_PREF",
]);

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

    if (!transaction || !GRANT_TYPES.has(type)) {
      return jsonOk({
        ignored: true,
        notificationType: type,
      });
    }

    const result = await fulfillAppleNotificationTx(transaction);
    return jsonOk({
      notificationType: type,
      processed: Boolean(result),
      alreadyProcessed: result?.alreadyProcessed ?? false,
      transactionId: transaction.transactionId,
    });
  } catch (err) {
    if (err instanceof Error) {
      console.error("[iap/apple/notify]", err.message);
      return jsonError(err.message, 400);
    }
    console.error(err);
    return jsonError("通知处理失败", 500);
  }
}
