import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { getDiamondBalance } from "@/lib/ai-relay";
import { DIAMONDS_PER_YUAN } from "@/lib/vip";

export async function OPTIONS() {
  return authPreflight();
}

/** Diamond balance for custom-course AI usage. */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const diamonds = await getDiamondBalance(user.id);
    return withAuthCors(
      jsonOk({
        diamonds,
        diamondsPerYuan: DIAMONDS_PER_YUAN,
        balanceYuan: diamonds / DIAMONDS_PER_YUAN,
      }),
    );
  } catch (err) {
    console.error(err);
    return withAuthCors(jsonError("读取钻石余额失败", 500));
  }
}
