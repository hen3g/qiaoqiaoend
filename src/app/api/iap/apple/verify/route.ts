import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { fulfillAppleTransaction } from "@/lib/apple-fulfill";
import { verifyAppleSignedTransaction } from "@/lib/apple-jws";
import { ipRateLimited } from "@/lib/ip-rate-limit";

const schema = z.object({
  jws: z.string().trim().min(20).max(120000),
  productId: z.string().trim().min(3).max(128).optional(),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Verify a StoreKit 2 JWS and grant VIP / diamonds. Idempotent. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录后再支付", 401));
    }

    const limited = await ipRateLimited(req, "iap-verify", { max: 20 });
    if (limited) return withAuthCors(limited);

    const body = schema.parse(await req.json());
    const tx = await verifyAppleSignedTransaction(body.jws);
    if (body.productId && body.productId !== tx.productId) {
      return withAuthCors(jsonError("商品与凭证不一致"));
    }

    const result = await fulfillAppleTransaction({
      tx,
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
      console.error("[iap/apple/verify]", err.message);
      const message = /asn1 encoding|error:06|DECODER routines/i.test(
        err.message,
      )
        ? "Apple 凭证校验失败，请稍后重试"
        : err.message;
      return withAuthCors(jsonError(message));
    }
    console.error(err);
    return withAuthCors(jsonError("校验失败，请稍后重试", 500));
  }
}
