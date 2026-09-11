import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { fulfillGooglePurchase } from "@/lib/google-fulfill";
import { ipRateLimited } from "@/lib/ip-rate-limit";
import { ErrorCode } from "@/lib/error-codes";

const schema = z.object({
  purchaseToken: z.string().trim().min(10).max(1024),
  productId: z.string().trim().min(3).max(128),
  signedData: z.string().trim().min(20).max(20000),
  signature: z.string().trim().min(20).max(4096),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Verify a Play-signed receipt locally (no Google API) and grant VIP. Idempotent. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录后再支付", 401, { code: ErrorCode.LOGIN_REQUIRED_PAY }));
    }

    const limited = await ipRateLimited(req, "iap-verify", { max: 20 });
    if (limited) return withAuthCors(limited);

    const body = schema.parse(await req.json());

    const result = await fulfillGooglePurchase({
      productId: body.productId,
      purchaseToken: body.purchaseToken,
      signedData: body.signedData,
      signature: body.signature,
      userId: user.id,
    });

    return withAuthCors(
      jsonOk({
        kind: result.kind,
        grantId: result.grantId,
        productId: result.productId,
        daysGranted: result.daysGranted,
        diamondsGranted: result.diamondsGranted,
        alreadyProcessed: result.alreadyProcessed,
        user: result.user,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    if (err instanceof Error) {
      console.error("[iap/google/verify]", err.message);
      return withAuthCors(jsonError(err.message));
    }
    console.error(err);
    return withAuthCors(jsonError("校验失败，请稍后重试", 500, { code: ErrorCode.VERIFY_FAILED }));
  }
}
