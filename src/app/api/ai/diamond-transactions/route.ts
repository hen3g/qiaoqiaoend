import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import { listDiamondTransactions } from "@/lib/diamond-transactions";
import { getUserDiamonds } from "@/lib/vip";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export async function OPTIONS() {
  return authPreflight();
}

/** Last 30 days of diamond transactions (spend + grant), 20 per page. */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    const { searchParams } = new URL(req.url);
    const { page } = listSchema.parse({
      page: searchParams.get("page") ?? 1,
    });

    const [result, diamonds] = await Promise.all([
      listDiamondTransactions(user.id, page),
      getUserDiamonds(user.id),
    ]);

    return withAuthCors(
      jsonOk({
        ...result,
        diamonds,
      }),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withAuthCors(jsonError(err.issues[0]?.message || "参数错误"));
    }
    console.error(err);
    return withAuthCors(jsonError("读取钻石记录失败", 500));
  }
}
