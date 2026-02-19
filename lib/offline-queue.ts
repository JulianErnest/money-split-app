import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("hatian_offline.db");

// Create table on module load
db.execSync(`
  CREATE TABLE IF NOT EXISTS offline_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending'
  )
`);

export type QueueItem = {
  id: number;
  action_type: string;
  payload: any;
  created_at: string;
  status: string;
};

/**
 * Enqueue an offline action. Returns the inserted row id.
 */
export function enqueue(actionType: string, payload: object): number {
  const result = db.runSync(
    "INSERT INTO offline_queue (action_type, payload) VALUES (?, ?)",
    actionType,
    JSON.stringify(payload)
  );
  return result.lastInsertRowId;
}

/**
 * Get all pending queue items ordered by created_at.
 */
export function getAll(): QueueItem[] {
  const rows = db.getAllSync(
    "SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY created_at ASC"
  );
  return (rows as QueueItem[]).map((row) => ({
    ...row,
    payload: JSON.parse(row.payload),
  }));
}

/**
 * Remove a queue item by id.
 */
export function remove(id: number): void {
  db.runSync("DELETE FROM offline_queue WHERE id = ?", id);
}

/**
 * Update the status of a queue item.
 */
export function updateStatus(
  id: number,
  status: "pending" | "failed"
): void {
  db.runSync("UPDATE offline_queue SET status = ? WHERE id = ?", status, id);
}

/**
 * Clear all items from the queue.
 */
export function clearAll(): void {
  db.runSync("DELETE FROM offline_queue");
}
