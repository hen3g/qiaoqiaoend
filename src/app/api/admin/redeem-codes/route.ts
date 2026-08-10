import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  createVipRedeemCodes,
  deleteRedeemCode,
  deleteRedeemCodes,
  listRedeemCodes,
} from "@/lib/redeem";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  permanent: z.boolean().default(false),
  days: z.number().int().min(1).max(36500).optional(),
  maxUses: z.number().int().min(1).max(10000).default(1),
  quantity: z.number().int().min(1).max(50).default(1),
  expiresAt: z.string().nullable().optional(),
});

const deleteSchema = z.object({
  id: z.number().int().positive().optional(),
  ids: z.array(z.number().int().positive()).min(1).max(200).optional(),
});

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "NOT_FOUND") return jsonError("不可用", 404);
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const codes = await listRedeemCodes();
    return jsonOk({ codes, total: codes.length });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    if (!body.permanent && body.days == null) {
      return jsonError("请填写会员天数，或选择永久会员");
    }
    const codes = await createVipRedeemCodes({
      permanent: body.permanent,
      days: body.days,
      maxUses: body.maxUses,
      quantity: body.quantity,
      expiresAt: body.expiresAt ?? null,
    });
    return jsonOk({ codes, message: `已生成 ${codes.length} 个兑换码` });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("生成失败", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const body = deleteSchema.parse(await req.json());
    if (body.ids?.length) {
      const deleted = await deleteRedeemCodes(body.ids);
      return jsonOk({ deleted, message: `已删除 ${deleted} 个兑换码` });
    }
    if (body.id != null) {
      await deleteRedeemCode(body.id);
      return jsonOk({ deleted: 1, message: "已删除兑换码" });
    }
    return jsonError("请指定要删除的兑换码");
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("删除失败", 500);
  }
}
