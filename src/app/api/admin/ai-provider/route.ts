import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  AiRelayError,
  AI_PROVIDER_IDS,
  getAiRuntimeStatus,
  setActiveAiProvider,
} from "@/lib/ai-relay";
import { requireAdmin } from "@/lib/dev-admin";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
});

function adminError(err: unknown) {
  if (err instanceof AiRelayError) {
    return jsonError(err.message, err.status);
  }
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    if (err.message === "FORBIDDEN") return jsonError("无权限", 403);
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const status = await getAiRuntimeStatus();
    return jsonOk(status);
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
    const body = updateSchema.parse(await req.json());
    const status = await setActiveAiProvider(body.provider);
    return jsonOk({ ...status, message: "已切换模型，立即生效" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.issues[0]?.message || "参数错误");
    }
    const mapped = adminError(err);
    if (mapped) return mapped;
    console.error(err);
    return jsonError("切换失败", 500);
  }
}
