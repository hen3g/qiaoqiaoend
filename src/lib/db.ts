import { AsyncLocalStorage } from "node:async_hooks";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

const txStore = new AsyncLocalStorage<PoolConnection>();

declare global {
  // eslint-disable-next-line no-var
  var __babyenglishDbPool: Pool | undefined;
}

type QueryParams = Record<string, string | number | boolean | null | Date>;

function createPool() {
  return mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    timezone: "+08:00",
  });
}

export function getPool(): Pool {
  if (!global.__babyenglishDbPool) {
    global.__babyenglishDbPool = createPool();
  }
  return global.__babyenglishDbPool;
}

function db() {
  return txStore.getStore() ?? getPool();
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: QueryParams,
): Promise<T> {
  const [rows] = await db().execute<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params?: QueryParams,
): Promise<ResultSetHeader> {
  const [result] = await db().execute<ResultSetHeader>(sql, params);
  return result;
}

/** Run `fn` on one MySQL connection with COMMIT / ROLLBACK. Nested calls reuse it. */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await txStore.run(conn, fn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* connection may already be closed */
    }
    throw err;
  } finally {
    conn.release();
  }
}
