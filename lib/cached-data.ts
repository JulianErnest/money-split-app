import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("hatian_offline.db");

// Create table on module load
db.execSync(`
  CREATE TABLE IF NOT EXISTS cached_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Store data in the cache. Upserts by key.
 * Key format: {userId}:{dataType} (e.g., "abc123:groups")
 */
export function setCachedData(key: string, data: any): void {
  db.runSync(
    `INSERT INTO cached_data (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(data)
  );
}

/**
 * Retrieve cached data by key. Returns null if not found.
 */
export function getCachedData<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM cached_data WHERE key = ?",
    key
  );
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

/**
 * Clear all cached data for a given user (keys starting with userId:).
 */
export function clearUserCache(userId: string): void {
  db.runSync("DELETE FROM cached_data WHERE key LIKE ?", `${userId}:%`);
}
