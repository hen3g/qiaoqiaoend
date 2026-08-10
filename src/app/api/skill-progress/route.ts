import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { authPreflight, withAuthCors } from "@/lib/auth-cors";
import {
  getSkillProgress,
  markPackStars,
  saveSkillProgress,
  unlockUserDifficulty,
  type ClearStars,
  type PackStarsMap,
} from "@/lib/skill-progress-db";

export async function OPTIONS() {
  return authPreflight();
}

function parsePackStarsBody(value: unknown): PackStarsMap | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("packStars 必须是对象");
  }
  const out: PackStarsMap = {};
  for (const [id, stars] of Object.entries(value as Record<string, unknown>)) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (stars === 1 || stars === 2 || stars === 3) {
      out[id] = stars;
    }
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }
    const progress = await getSkillProgress(user.id);
    return withAuthCors(jsonOk({ progress }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "读取进度失败", 500),
    );
  }
}

/**
 * 全量/批量同步。
 * Body:
 *   packStars?: Record<string, 1|2|3>
 *   lastPackId?: string | null
 *   completedPackIds?: string[]          // 兼容 web；无 packStars 时合成 1★
 *   jumpUnlockedSeriesIds?: string[]
 *   mergeStars?: boolean                 // true=星级只升不降合并；默认 false 全量覆盖
 */
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    let body: {
      packStars?: unknown;
      lastPackId?: string | null;
      completedPackIds?: string[];
      jumpUnlockedSeriesIds?: string[];
      mergeStars?: boolean;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    let packStars: PackStarsMap | undefined;
    try {
      packStars = parsePackStarsBody(body.packStars);
    } catch (err) {
      return withAuthCors(
        jsonError(err instanceof Error ? err.message : "packStars 无效"),
      );
    }

    const progress = await saveSkillProgress(user.id, {
      packStars,
      lastPackId: body.lastPackId,
      completedPackIds: Array.isArray(body.completedPackIds)
        ? body.completedPackIds
        : undefined,
      jumpUnlockedSeriesIds: Array.isArray(body.jumpUnlockedSeriesIds)
        ? body.jumpUnlockedSeriesIds
        : undefined,
      mergeStars: Boolean(body.mergeStars),
    });

    return withAuthCors(jsonOk({ progress }));
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "保存进度失败", 500),
    );
  }
}

/**
 * 增量更新。
 * Body 三选一：
 *   { packId, stars, lastPackId? }  — 通关记星（只升不降）
 *   { lastPackId }                  — 仅更新继续学习指针
 *   { unlockedDifficulty }          — 兼容 web 解锁难度 2–5
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return withAuthCors(jsonError("请先登录", 401));
    }

    let body: {
      packId?: string;
      stars?: number;
      lastPackId?: string | null;
      unlockedDifficulty?: number;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return withAuthCors(jsonError("请求体必须是 JSON"));
    }

    if (typeof body.packId === "string" && body.packId.trim()) {
      const stars = body.stars as ClearStars;
      if (stars !== 1 && stars !== 2 && stars !== 3) {
        return withAuthCors(jsonError("星级必须是 1–3"));
      }
      const progress = await markPackStars(
        user.id,
        body.packId,
        stars,
        body.lastPackId !== undefined ? body.lastPackId : undefined,
      );
      return withAuthCors(jsonOk({ progress }));
    }

    if (body.unlockedDifficulty !== undefined) {
      const unlockedDifficulty = Number(body.unlockedDifficulty);
      if (
        !Number.isInteger(unlockedDifficulty) ||
        unlockedDifficulty < 2 ||
        unlockedDifficulty > 5
      ) {
        return withAuthCors(jsonError("星级必须是 2–5"));
      }
      const current = await getSkillProgress(user.id);
      if (unlockedDifficulty > current.unlockedDifficulty + 1) {
        return withAuthCors(jsonError("请先解锁前一个星级", 409));
      }
      const progress = await unlockUserDifficulty(user.id, unlockedDifficulty);
      return withAuthCors(jsonOk({ progress }));
    }

    if (body.lastPackId !== undefined) {
      const progress = await saveSkillProgress(user.id, {
        lastPackId: body.lastPackId,
      });
      return withAuthCors(jsonOk({ progress }));
    }

    return withAuthCors(
      jsonError("请提供 packId+stars、lastPackId 或 unlockedDifficulty"),
    );
  } catch (err) {
    console.error(err);
    return withAuthCors(
      jsonError(err instanceof Error ? err.message : "更新进度失败", 500),
    );
  }
}
