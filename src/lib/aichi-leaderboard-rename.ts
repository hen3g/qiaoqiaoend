import type { RowDataPacket } from "mysql2";

import {
  AICHI_VIP_PREFIX,
  ensureAichiVipGrantsTable,
} from "@/lib/aichi-vip-promo";
import { execute, query } from "@/lib/db";
import { getLearnRankingBoard } from "@/lib/learn-ranking-db";
import { createNotification } from "@/lib/notifications";
import {
  MAX_NICKNAME_LENGTH,
  validateNickname,
} from "@/lib/nickname-validate";
import { getRankingBoard } from "@/lib/ranking-db";

export const AICHI_LEADERBOARD_RENAME_TITLE = "昵称调整通知";
export const AICHI_LEADERBOARD_RENAME_SUMMARY =
  "由于你处于学习排行榜中，已将你的爱吃文字去掉。你可以自行修改其他昵称，不影响获得的会员。";

export type AichiLeaderboardRenameItem = {
  userId: number;
  oldNickname: string;
  newNickname: string;
  notified: boolean;
  error?: string;
};

export type AichiLeaderboardRenameResult = {
  scanned: number;
  renamed: number;
  notified: number;
  failed: number;
  items: AichiLeaderboardRenameItem[];
};

/** Collect distinct user ids currently on any of the four learning leaderboards. */
export async function listLeaderboardUserIds(): Promise<number[]> {
  const [total, today, week, month] = await Promise.all([
    getRankingBoard("total", null, 100),
    getRankingBoard("today", null, 100),
    getLearnRankingBoard("hamster", "week", null),
    getLearnRankingBoard("hamster", "month", null),
  ]);

  const ids = new Set<number>();
  for (const board of [total, today, week, month]) {
    for (const entry of board.entries) {
      if (entry.userId > 0) ids.add(entry.userId);
    }
  }
  return [...ids];
}

function hasAichiPrefix(nickname: string | null | undefined): boolean {
  return (nickname ?? "").trim().startsWith(AICHI_VIP_PREFIX);
}

/** Strip leading 「爱吃」 once; fall back if remainder is empty. */
export function stripAichiNicknamePrefix(
  nickname: string,
  userId: number,
): string {
  const trimmed = nickname.trim();
  let base = trimmed.startsWith(AICHI_VIP_PREFIX)
    ? trimmed.slice(AICHI_VIP_PREFIX.length).trim()
    : trimmed;
  if (!base) {
    base = `用户${userId}`;
  }
  if (base.length > MAX_NICKNAME_LENGTH) {
    base = base.slice(0, MAX_NICKNAME_LENGTH);
  }
  return base;
}

async function isNicknameTaken(
  nickname: string,
  excludeUserId: number,
  reservedLower: Set<string>,
): Promise<boolean> {
  const key = nickname.toLowerCase();
  if (reservedLower.has(key)) return true;
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM users
     WHERE LOWER(nickname) = LOWER(:nickname) AND id <> :id
     LIMIT 1`,
    { nickname, id: excludeUserId },
  );
  return Boolean(rows[0]);
}

/**
 * Pick a free nickname: try `base`, then `base2`, `base3`, ...
 * Truncates base when suffix would exceed max length.
 */
export async function allocateUniqueStrippedNickname(
  baseRaw: string,
  userId: number,
  reservedLower: Set<string>,
): Promise<string> {
  let base = baseRaw.trim() || `用户${userId}`;
  if (base.length > MAX_NICKNAME_LENGTH) {
    base = base.slice(0, MAX_NICKNAME_LENGTH);
  }

  const tryCandidate = async (candidate: string): Promise<string | null> => {
    const checked = validateNickname(candidate);
    if (!checked.ok) return null;
    if (await isNicknameTaken(checked.nickname, userId, reservedLower)) {
      return null;
    }
    return checked.nickname;
  };

  const first = await tryCandidate(base);
  if (first) return first;

  for (let n = 2; n <= 9999; n += 1) {
    const suffix = String(n);
    const maxBase = MAX_NICKNAME_LENGTH - suffix.length;
    if (maxBase < 1) break;
    const candidate =
      (base.length > maxBase ? base.slice(0, maxBase) : base) + suffix;
    const ok = await tryCandidate(candidate);
    if (ok) return ok;
  }

  // Last resort: guaranteed unique-ish by user id
  const fallback = `用户${userId}`;
  const ok = await tryCandidate(fallback);
  if (ok) return ok;
  return `用户${userId}_${Date.now().toString(36).slice(-4)}`.slice(
    0,
    MAX_NICKNAME_LENGTH,
  );
}

type TargetRow = RowDataPacket & {
  user_id: number;
  nickname: string | null;
};

/**
 * Users who:
 * 1) appear on any of the four learning leaderboards (top 100 each),
 * 2) received VIP via the 爱吃 nickname promo,
 * 3) still have a nickname starting with 「爱吃」.
 */
export async function listLeaderboardAichiPrefixTargets(): Promise<
  { userId: number; nickname: string }[]
> {
  await ensureAichiVipGrantsTable();
  const boardIds = await listLeaderboardUserIds();
  if (boardIds.length === 0) return [];

  const idList = boardIds.map((_, i) => `:id${i}`).join(", ");
  const rows = await query<TargetRow[]>(
    `SELECT g.user_id, u.nickname
     FROM aichi_vip_grants g
     INNER JOIN users u ON u.id = g.user_id
     WHERE g.user_id IN (${idList})`,
    Object.fromEntries(boardIds.map((id, i) => [`id${i}`, id])),
  );

  return rows
    .filter((row) => hasAichiPrefix(row.nickname))
    .map((row) => ({
      userId: Number(row.user_id),
      nickname: (row.nickname ?? "").trim(),
    }));
}

/**
 * Strip 「爱吃」 from matching leaderboard users and send a hamster DM.
 * Safe to re-run; only users still prefixed are touched.
 */
export async function renameLeaderboardAichiUsersAndNotify(): Promise<AichiLeaderboardRenameResult> {
  const targets = await listLeaderboardAichiPrefixTargets();
  const reservedLower = new Set<string>();
  const items: AichiLeaderboardRenameItem[] = [];
  let renamed = 0;
  let notified = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      const stripped = stripAichiNicknamePrefix(target.nickname, target.userId);
      const newNickname = await allocateUniqueStrippedNickname(
        stripped,
        target.userId,
        reservedLower,
      );

      await execute(`UPDATE users SET nickname = :nickname WHERE id = :id`, {
        nickname: newNickname,
        id: target.userId,
      });
      reservedLower.add(newNickname.toLowerCase());
      renamed += 1;

      let notifyOk = false;
      try {
        await createNotification({
          type: "message",
          appId: "hamster",
          userId: target.userId,
          locale: null,
          version: null,
          title: AICHI_LEADERBOARD_RENAME_TITLE,
          summary: AICHI_LEADERBOARD_RENAME_SUMMARY,
          titleJa: null,
          summaryJa: null,
          imageUrl: null,
          linkUrl: null,
        });
        notifyOk = true;
        notified += 1;
      } catch (notifyErr) {
        console.error(
          "aichi leaderboard rename notify failed",
          target.userId,
          notifyErr,
        );
      }

      items.push({
        userId: target.userId,
        oldNickname: target.nickname,
        newNickname,
        notified: notifyOk,
        error: notifyOk ? undefined : "昵称已改，私信发送失败",
      });
    } catch (err) {
      failed += 1;
      console.error("aichi leaderboard rename failed", target.userId, err);
      items.push({
        userId: target.userId,
        oldNickname: target.nickname,
        newNickname: target.nickname,
        notified: false,
        error: err instanceof Error ? err.message : "处理失败",
      });
    }
  }

  return {
    scanned: targets.length,
    renamed,
    notified,
    failed,
    items,
  };
}
