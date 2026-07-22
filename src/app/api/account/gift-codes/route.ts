import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  createDailyGiftCode,
  listGiftCodesForUser,
} from "@/lib/gift-codes";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

function mapAuthError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return jsonError("请先登录", 401);
  }
  return null;
}

function requirePermanentVip(user: { isPermanentVip: boolean }) {
  if (!user.isPermanentVip) {
    throw new Error("FORBIDDEN");
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    requirePermanentVip(user);
    const { searchParams } = new URL(req.url);
    const { page } = listSchema.parse({
      page: searchParams.get("page") ?? 1,
    });
    const result = await listGiftCodesForUser(user.id, page);
    return jsonOk(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapAuthError(err);
    if (mapped) return mapped;
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return jsonError("仅永久会员可使用", 403);
    }
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    requirePermanentVip(user);
    const code = await createDailyGiftCode(user.id);
    return jsonOk({ code, message: "已生成 180 天会员激活码" });
  } catch (err) {
    const mapped = mapAuthError(err);
    if (mapped) return mapped;
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return jsonError("仅永久会员可使用", 403);
    }
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("生成失败", 500);
  }
}
