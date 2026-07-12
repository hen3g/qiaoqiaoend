import Cap from "@cap.js/server";
import type { RowDataPacket } from "mysql2";
import { execute, query } from "@/lib/db";

type ChallengeData = {
  challenge: { c: number; s: number; d: number };
  expires: number;
};

type ChallengeRow = RowDataPacket & {
  data: ChallengeData | string;
  expires: number | string;
};

type TokenRow = RowDataPacket & {
  expires: number | string;
};

declare global {
  // eslint-disable-next-line no-var
  var __babyenglishCap: Cap | undefined;
}

function parseChallengeData(raw: ChallengeData | string): ChallengeData {
  if (typeof raw === "string") {
    return JSON.parse(raw) as ChallengeData;
  }
  return raw;
}

export function getCap(): Cap {
  if (!global.__babyenglishCap) {
    global.__babyenglishCap = new Cap({
      noFSState: true,
      storage: {
        challenges: {
          store: async (token, challengeData) => {
            await execute(
              `INSERT INTO cap_challenges (token, data, expires)
               VALUES (:token, CAST(:data AS JSON), :expires)
               ON DUPLICATE KEY UPDATE
                 data = VALUES(data),
                 expires = VALUES(expires)`,
              {
                token,
                data: JSON.stringify(challengeData),
                expires: challengeData.expires,
              },
            );
          },
          read: async (token) => {
            const rows = await query<ChallengeRow[]>(
              `SELECT data, expires FROM cap_challenges
               WHERE token = :token AND expires > :now
               LIMIT 1`,
              { token, now: Date.now() },
            );
            if (!rows[0]) return null;
            return parseChallengeData(rows[0].data);
          },
          delete: async (token) => {
            await execute(`DELETE FROM cap_challenges WHERE token = :token`, {
              token,
            });
          },
          deleteExpired: async () => {
            await execute(`DELETE FROM cap_challenges WHERE expires <= :now`, {
              now: Date.now(),
            });
          },
        },
        tokens: {
          store: async (tokenKey, expires) => {
            await execute(
              `INSERT INTO cap_tokens (token_key, expires)
               VALUES (:tokenKey, :expires)
               ON DUPLICATE KEY UPDATE expires = VALUES(expires)`,
              { tokenKey, expires },
            );
          },
          get: async (tokenKey) => {
            const rows = await query<TokenRow[]>(
              `SELECT expires FROM cap_tokens
               WHERE token_key = :tokenKey AND expires > :now
               LIMIT 1`,
              { tokenKey, now: Date.now() },
            );
            return rows[0] ? Number(rows[0].expires) : null;
          },
          delete: async (tokenKey) => {
            await execute(`DELETE FROM cap_tokens WHERE token_key = :tokenKey`, {
              tokenKey,
            });
          },
          deleteExpired: async () => {
            await execute(`DELETE FROM cap_tokens WHERE expires <= :now`, {
              now: Date.now(),
            });
          },
        },
      },
    });
  }
  return global.__babyenglishCap;
}

export async function requireCapToken(token: string | undefined | null) {
  if (!token || typeof token !== "string") {
    throw new Error("请先完成人机验证");
  }
  const result = await getCap().validateToken(token);
  if (!result.success) {
    throw new Error("人机验证失败或已过期，请重试");
  }
}
