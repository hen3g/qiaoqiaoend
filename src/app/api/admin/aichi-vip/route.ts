import { z } from "zod";
import {
  listLeaderboardAichiPrefixTargets,
  renameLeaderboardAichiUsersAndNotify,
} from "@/lib/aichi-leaderboard-rename";
import {
  countAichiVipGrants,
  getAichiVipPromoSettings,
  listAllAichiVipGrantUserIds,
  listRecentAichiVipGrants,
  setAichiVipPromoEnabled,
  AICHI_VIP_DAYS,
  AICHI_VIP_MIN_EXTRA_CHARS,
  AICHI_VIP_PREFIX,
} from "@/lib/aichi-vip-promo";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const setEnabledSchema = z.object({
  action: z.literal("setEnabled"),
  enabled: z.boolean(),
});

const notifyGranteesSchema = z.object({
  action: z.literal("notifyGrantees"),
  title: z.string().trim().min(1, "请填写标题").max(200),
  summary: z.string().trim().min(1, "请填写简介").max(500),
  titleJa: z
    .union([z.string().trim().max(200), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  summaryJa: z
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
});

const stripLeaderboardAichiSchema = z.object({
  action: z.literal("stripLeaderboardAichi"),
});

const previewLeaderboardAichiSchema = z.object({
  action: z.literal("previewLeaderboardAichi"),
});

const postSchema = z.discriminatedUnion("action", [
  setEnabledSchema,
  notifyGranteesSchema,
  stripLeaderboardAichiSchema,
  previewLeaderboardAichiSchema,
]);

function adminError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const [settings, grants, grantCount] = await Promise.all([
      getAichiVipPromoSettings(),
      listRecentAichiVipGrants(50),
      countAichiVipGrants(),
    ]);
    return jsonOk({
      settings,
      grants,
      grantCount,
      rule: {
        field: "nickname",
        prefix: AICHI_VIP_PREFIX,
        minExtraChars: AICHI_VIP_MIN_EXTRA_CHARS,
        days: AICHI_VIP_DAYS,
        years: 99,
        skipIfAlreadyVip: true,
        oncePerUser: true,
        triggers: ["register", "rename"],
      },
    });
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
    const body = postSchema.parse(await req.json());

    if (body.action === "setEnabled") {
      const settings = await setAichiVipPromoEnabled(body.enabled);
      return jsonOk({
        settings,
        message: settings.enabled
          ? "已开启爱吃昵称 VIP 活动"
          : "已关闭爱吃昵称 VIP 活动",
      });
    }

    if (body.action === "previewLeaderboardAichi") {
      const targets = await listLeaderboardAichiPrefixTargets();
      return jsonOk({
        count: targets.length,
        targets: targets.slice(0, 50),
        message:
          targets.length === 0
            ? "当前排行榜中没有仍带「爱吃」前缀的领会员用户"
            : `将处理 ${targets.length} 位用户（去掉昵称前缀并发送私信）`,
      });
    }

    if (body.action === "stripLeaderboardAichi") {
      const result = await renameLeaderboardAichiUsersAndNotify();
      return jsonOk({
        ...result,
        message:
          result.scanned === 0
            ? "当前排行榜中没有仍带「爱吃」前缀的领会员用户"
            : result.failed === 0
              ? `已处理 ${result.renamed} 人：去掉爱吃前缀并发送私信 ${result.notified} 条`
              : `已改名 ${result.renamed} 人，私信 ${result.notified} 条，失败 ${result.failed} 人`,
      });
    }

    const userIds = await listAllAichiVipGrantUserIds();
    if (userIds.length === 0) {
      return jsonError("暂无通过爱吃领取会员的用户");
    }

    let sent = 0;
    const failed: number[] = [];
    for (const userId of userIds) {
      try {
        await createNotification({
          type: "message",
          appId: "hamster",
          userId,
          locale: null,
          version: null,
          title: body.title,
          summary: body.summary,
          titleJa: body.titleJa,
          summaryJa: body.summaryJa,
          imageUrl: body.imageUrl,
          linkUrl: body.linkUrl,
        });
        sent += 1;
      } catch (err) {
        console.error("aichi vip notify failed", userId, err);
        failed.push(userId);
      }
    }

    return jsonOk({
      total: userIds.length,
      sent,
      failed,
      message:
        failed.length === 0
          ? `已向 ${sent} 位爱吃领会员用户发送私信`
          : `已发送 ${sent}/${userIds.length}，失败 ${failed.length} 人`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("操作失败", 500);
  }
}
