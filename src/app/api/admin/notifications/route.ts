import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  createNotification,
  deleteNotification,
  findUserByUsernameOrId,
  listNotifications,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    type: z.enum(["update", "message"]),
    version: z
      .union([z.string().trim().max(64), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    title: z.string().trim().min(1, "请填写标题").max(200),
    summary: z.string().trim().min(1, "请填写简介").max(500),
    appId: z.enum(["all", "qiaoqiao", "hamster"]).optional().default("all"),
    targetUser: z
      .string()
      .trim()
      .max(32)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    imageUrl: z
      .union([
        z.string().trim().url("图片链接无效").max(500),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    linkUrl: z
      .union([
        z.string().trim().url("跳转链接无效").max(500),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .superRefine((data, ctx) => {
    if (data.type === "update" && !data.version) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message: "更新通知请填写版本号",
      });
    }
    if (data.targetUser && data.type !== "message") {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "指定用户仅支持消息通知",
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
    await requireAdmin();
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
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    let userId: number | null = null;
    if (body.targetUser) {
      const target = await findUserByUsernameOrId(body.targetUser);
      if (!target) {
        return jsonError("用户不存在", 404);
      }
      userId = target.id;
    }
    const notification = await createNotification({
      type: body.type,
      appId: userId != null ? "hamster" : body.appId,
      userId,
      version: body.type === "update" ? body.version : null,
      title: body.title,
      summary: body.summary,
      imageUrl: body.imageUrl,
      linkUrl: body.linkUrl,
    });
    return jsonOk({
      notification,
      message: userId != null ? "已发给该用户（仅仓鼠单词可见）" : "已发布通知",
    });
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
    await requireAdmin();
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
