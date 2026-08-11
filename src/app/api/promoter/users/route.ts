import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  listPromoterReferredUsers,
  requirePromoterUser,
} from "@/lib/promoter";
import { ensureUserDiamondsColumn } from "@/lib/user-schema";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function mapError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("仅推广者可使用", 403);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await requirePromoterUser(user.id);
    await ensureUserDiamondsColumn();

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: url.searchParams.get("q") || undefined,
      page: url.searchParams.get("page") || undefined,
      pageSize: url.searchParams.get("pageSize") || undefined,
    });
    if (!parsed.success) {
      return jsonError("参数错误", 400);
    }

    const result = await listPromoterReferredUsers(user.id, {
      q: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return jsonOk({
      users: result.users,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
