import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  listPromoterCodeUsers,
  requirePromoterUser,
} from "@/lib/promoter";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

function mapError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("仅推广者可使用", 403);
  }
  return null;
}

type RouteContext = { params: { id: string } };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    await requirePromoterUser(user.id);
    const { id } = paramsSchema.parse(context.params);
    const users = await listPromoterCodeUsers(user.id, id);
    return jsonOk({ users });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("加载失败", 500);
  }
}
