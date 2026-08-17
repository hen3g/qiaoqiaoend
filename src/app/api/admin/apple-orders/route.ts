import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  listAdminAppleOrders,
  type AppleOrderStatus,
  type AppleTxKind,
} from "@/lib/apple-transactions";
import { requireAdmin } from "@/lib/dev-admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["paid", "refunded"]).optional(),
  kind: z.enum(["vip", "diamonds"]).optional(),
  q: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      status: url.searchParams.get("status") || undefined,
      kind: url.searchParams.get("kind") || undefined,
      q: url.searchParams.get("q") || undefined,
      page: url.searchParams.get("page") || undefined,
      pageSize: url.searchParams.get("pageSize") || undefined,
    });
    if (!parsed.success) {
      return jsonError("参数错误", 400);
    }

    const result = await listAdminAppleOrders({
      status: parsed.data.status as AppleOrderStatus | undefined,
      kind: parsed.data.kind as AppleTxKind | undefined,
      q: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return jsonOk({
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      summary: {
        total: result.summary.total,
        paidCount: result.summary.paidCount,
        refundedCount: result.summary.refundedCount,
        paidYuan: (result.summary.paidFen / 100).toFixed(2),
      },
      orders: result.orders,
    });
  } catch (err) {
    return adminError(err) ?? jsonError("加载失败", 500);
  }
}
