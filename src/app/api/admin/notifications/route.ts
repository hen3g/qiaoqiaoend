import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  createNotification,
  deleteNotification,
  findUserByUsernameOrId,
  listNotifications,
  parseTargetUserTokens,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    type: z.enum(["update", "message"]),
    version: z
      .union([z.string().trim().max(64), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    title: z
      .union([z.string().trim().max(200), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    summary: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    titleJa: z
      .union([z.string().trim().max(200), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    summaryJa: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    appId: z.enum(["qiaoqiao", "hamster"]).optional().default("qiaoqiao"),
    /** Broadcast audience language; omit/null = all locales. Ignored for target users. */
    locale: z.enum(["zh", "ja"]).nullable().optional(),
    targetUser: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
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
    const hasZh = Boolean(data.title && data.summary);
    const hasJa = Boolean(data.titleJa && data.summaryJa);
    if (!hasZh && !hasJa) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "请至少完整填写一种语言的标题和简介",
      });
    }
    if (data.appId === "qiaoqiao" && !hasZh) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "敲敲英语请填写中文标题和简介",
      });
    }
    if (!data.targetUser && data.locale === "zh" && !hasZh) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "中文受众请填写中文标题和简介",
      });
    }
    if (!data.targetUser && data.locale === "ja" && !hasJa) {
      ctx.addIssue({
        code: "custom",
        path: ["titleJa"],
        message: "日文受众请填写日文标题和简介",
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

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const appParam = url.searchParams.get("app");
    const appId =
      appParam === "hamster" || appParam === "qiaoqiao" ? appParam : undefined;
    const notifications = await listNotifications(appId ? { appId } : undefined);
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

    if (body.targetUser) {
      const tokens = parseTargetUserTokens(body.targetUser);
      if (tokens.length === 0) {
        return jsonError("请填写要发送的用户名或用户 ID");
      }
      const missing: string[] = [];
      const targets = [];
      for (const token of tokens) {
        const target = await findUserByUsernameOrId(token);
        if (!target) missing.push(token);
        else targets.push(target);
      }
      if (missing.length) {
        return jsonError(`用户不存在：${missing.join(", ")}`, 404);
      }

      const notifications = [];
      for (const target of targets) {
        notifications.push(
          await createNotification({
            type: "message",
            appId: "hamster",
            userId: target.id,
            locale: null,
            version: null,
            title: body.title || body.titleJa || "",
            summary: body.summary || body.summaryJa || "",
            titleJa: body.titleJa,
            summaryJa: body.summaryJa,
            imageUrl: body.imageUrl,
            linkUrl: body.linkUrl,
          }),
        );
      }
      return jsonOk({
        notifications,
        notification: notifications[0],
        message:
          notifications.length === 1
            ? "已发给该用户（不限制语言，按用户 locale 展示文案）"
            : `已发给 ${notifications.length} 位用户（不限制语言）`,
      });
    }

    const notification = await createNotification({
      type: body.type,
      appId: body.appId,
      userId: null,
      locale: body.locale ?? null,
      version: body.type === "update" ? body.version : null,
      title: body.title || body.titleJa || "",
      summary: body.summary || body.summaryJa || "",
      titleJa: body.titleJa,
      summaryJa: body.summaryJa,
      imageUrl: body.imageUrl,
      linkUrl: body.linkUrl,
    });
    return jsonOk({
      notification,
      message: "已发布通知",
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
