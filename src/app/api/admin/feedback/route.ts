import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/dev-admin";
import {
  listFeedbackSubmissions,
  replyToFeedbackSubmission,
} from "@/lib/feedback";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const FEEDBACK_REPLY_NOTIFY_TITLE = "反馈回复";
const FEEDBACK_REPLY_NOTIFY_SUMMARY =
  "你的反馈已经得到回复。请前往反馈->历史反馈中查看。";

const replySchema = z.object({
  action: z.literal("reply"),
  id: z.number().int().positive(),
  reply: z
    .string()
    .trim()
    .min(1, "请填写回复内容")
    .max(2000, "回复内容过长"),
  /** Only applied for hamster feedback; ignored otherwise. */
  notifyUser: z.boolean().optional().default(false),
});

function mapAdminError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return jsonError("请先登录", 401);
  }
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const submissions = await listFeedbackSubmissions();
    return jsonOk({ submissions, total: submissions.length });
  } catch (err) {
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("加载失败", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = replySchema.parse(await req.json());
    const submission = await replyToFeedbackSubmission({
      id: body.id,
      reply: body.reply,
    });

    let notified = false;
    if (body.notifyUser && submission.appId === "hamster") {
      try {
        await createNotification({
          type: "message",
          appId: "hamster",
          userId: submission.userId,
          version: null,
          title: FEEDBACK_REPLY_NOTIFY_TITLE,
          summary: FEEDBACK_REPLY_NOTIFY_SUMMARY,
          imageUrl: null,
          linkUrl: null,
        });
        notified = true;
      } catch (err) {
        console.error("feedback reply notify:", err);
        return jsonOk({
          submission,
          notified: false,
          message: "已回复，但通知发送失败",
        });
      }
    }

    return jsonOk({
      submission,
      notified,
      message: notified ? "已回复并通知用户" : "已回复",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = mapAdminError(err);
    if (mapped) return mapped;
    if (err instanceof Error) return jsonError(err.message);
    console.error(err);
    return jsonError("操作失败", 500);
  }
}
