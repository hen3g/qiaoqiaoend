import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Play RTDN cannot be verified without calling Google, so this host
 * acknowledges the push and ignores it. Entitlement is granted from
 * POST /api/iap/google/verify using the on-device signed receipt.
 */
export async function POST() {
  return jsonOk({ ignored: true });
}
