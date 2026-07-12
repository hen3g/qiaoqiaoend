import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireDevAdmin } from "@/lib/dev-admin";
import {
  createNotification,
  deleteNotification,
  listNotifications,
} from "@/lib/notifications";

const createSchema = z
  .object({
    type: z.enum(["update", "message"]),
    version: z
      .union([z.string().trim().max(64), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    title: z.string().trim().min(1, "请填写标题").max(200),
    summary: z.string().trim().min(1, "请填写简介").max(500),
    imageUrl: z
      .union([
        z.string().trim().url("图片链接无效").max(500),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    linkUrl: z.string().trim().url("跳转链接无效").max(500),
  })
  .superRefine((data, ctx) => {
    if (data.type === "update" && !data.version) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message: "更新通知请填写版本号",
      });
    }
  });

const deleteSchema = z.object({
  id: z.number().int().positive(),
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
    await requireDevAdmin();
    const notifications = await listNotifications();
    return jsonOk({ notifications, total: notifications.length });
  } catch (err) {
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireDevAdmin();
    const body = createSchema.parse(await req.json());
    const notification = await createNotification({
      ...body,
      version: body.type === "update" ? body.version : null,
    });
    return jsonOk({ notification, message: "已发布通知" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("发布失败", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireDevAdmin();
    const body = deleteSchema.parse(await req.json());
    await deleteNotification(body.id);
    return jsonOk({ deleted: 1, message: "已删除通知" });
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
