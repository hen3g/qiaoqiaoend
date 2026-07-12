import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

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

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: QueryParams,
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params?: QueryParams,
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}
