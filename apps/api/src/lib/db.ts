// Typed helpers around D1 (Cloudflare D1 = real SQLite 3.45+ with FTS5).

export type DB = D1Database;

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: {
    size?: number;
    duration?: number;
    changes?: number;
    last_row_id?: number;
    changed_db?: boolean;
  };
}

/** First row (or null) — takes the prepared statement directly. */
export async function one<T>(stmt: D1PreparedStatement): Promise<T | null> {
  return ((await stmt.first<T>()) ?? null) as T | null;
}

/** All rows — takes the prepared statement directly. */
export async function all<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const res = await stmt.all<T>();
  return res.results;
}

export function lastId(res: D1Result): number | null {
  return res.meta?.last_row_id ?? null;
}

/** Batch runner that surfaces failures with context instead of dropping them. */
export async function safeBatch(
  db: DB,
  ops: D1PreparedStatement[],
  label: string,
): Promise<number> {
  try {
    await db.batch(ops);
    return ops.length;
  } catch (e) {
    throw new Error(`${label} batch failed: ${String(e)}`);
  }
}
