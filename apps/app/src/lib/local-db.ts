import type { TaskView } from '@mui-memo/shared/logic';
import type { Attachment, CompletedTask, RecurrenceInfo } from '@mui-memo/shared/dto';
import * as SQLite from 'expo-sqlite';
import { mergeTaskPatch, type LocalTaskPatch } from '@/lib/local-cache-model';

const DB_NAME = 'mui-memo-local.db';
const TASKS_SYNC_KEY = 'tasks_synced_at';
const CURRENT_USER_KEY = 'current_user_id';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export interface CachedTaskDetail {
  task: TaskView;
  recurrence: RecurrenceInfo | null;
  attachments: Attachment[];
}

interface JsonRow {
  json: string;
}

interface MetaRow {
  value: string;
}

interface OrderRow {
  cached_order: number;
}

export async function initLocalDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS local_tasks (
          id TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL,
          cached_order INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_completed_tasks (
          id TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL,
          completed_at TEXT,
          cached_order INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_task_details (
          id TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function prepareLocalCacheForUser(userId: string): Promise<boolean> {
  const current = await getSyncMeta(CURRENT_USER_KEY);
  if (current && current !== userId) {
    await clearLocalCache();
    await setSyncMeta(CURRENT_USER_KEY, userId);
    return true;
  }
  await setSyncMeta(CURRENT_USER_KEY, userId);
  return false;
}

export async function clearLocalCache(): Promise<void> {
  const db = await initLocalDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM local_tasks;
      DELETE FROM local_completed_tasks;
      DELETE FROM local_task_details;
      DELETE FROM sync_meta;
    `);
  });
}

export async function loadCachedTasks(): Promise<TaskView[]> {
  const db = await initLocalDb();
  const rows = await db.getAllAsync<JsonRow>('SELECT json FROM local_tasks ORDER BY cached_order ASC');
  return rows.map((row) => parseJson<TaskView>(row.json)).filter((task): task is TaskView => Boolean(task));
}

export async function replaceCachedTasks(tasks: TaskView[]): Promise<void> {
  const db = await initLocalDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM local_tasks');
    for (const [index, task] of tasks.entries()) {
      await db.runAsync(
        'INSERT INTO local_tasks (id, json, cached_order, updated_at) VALUES (?, ?, ?, ?)',
        task.id,
        JSON.stringify(task),
        index,
        now,
      );
    }
    await setSyncMetaInDb(db, TASKS_SYNC_KEY, now);
  });
}

export async function loadCachedCompletedFirstPage(): Promise<CompletedTask[]> {
  const db = await initLocalDb();
  const rows = await db.getAllAsync<JsonRow>('SELECT json FROM local_completed_tasks ORDER BY cached_order ASC');
  return rows.map((row) => parseJson<CompletedTask>(row.json)).filter((task): task is CompletedTask => Boolean(task));
}

export async function replaceCachedCompletedFirstPage(tasks: CompletedTask[]): Promise<void> {
  const db = await initLocalDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM local_completed_tasks');
    for (const [index, task] of tasks.entries()) {
      await db.runAsync(
        'INSERT INTO local_completed_tasks (id, json, completed_at, cached_order, updated_at) VALUES (?, ?, ?, ?, ?)',
        task.id,
        JSON.stringify(task),
        task.completedAt,
        index,
        now,
      );
    }
  });
}

export async function removeCachedCompletedTask(id: string): Promise<void> {
  const db = await initLocalDb();
  await db.runAsync('DELETE FROM local_completed_tasks WHERE id = ?', id);
}

export async function loadCachedTaskDetail(id: string): Promise<CachedTaskDetail | null> {
  const db = await initLocalDb();
  const row = await db.getFirstAsync<JsonRow>('SELECT json FROM local_task_details WHERE id = ?', id);
  return row ? parseJson<CachedTaskDetail>(row.json) : null;
}

export async function saveCachedTaskDetail(detail: CachedTaskDetail): Promise<void> {
  const db = await initLocalDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await upsertCachedTaskInDb(db, detail.task, now);
    await db.runAsync(
      'INSERT OR REPLACE INTO local_task_details (id, json, updated_at) VALUES (?, ?, ?)',
      detail.task.id,
      JSON.stringify(detail),
      now,
    );
  });
}

export async function applyLocalTaskPatch(id: string, patch: LocalTaskPatch): Promise<TaskView | null> {
  const db = await initLocalDb();
  const row = await db.getFirstAsync<JsonRow>('SELECT json FROM local_tasks WHERE id = ?', id);
  const task = row ? parseJson<TaskView>(row.json) : null;
  if (!task) return null;

  const next = mergeTaskPatch(task, patch);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE local_tasks SET json = ?, updated_at = ? WHERE id = ?', JSON.stringify(next), now, id);
    if (next.status === 'done') {
      const completed: CompletedTask = {
        id: next.id,
        text: next.text,
        tags: next.tags ?? [],
        completedAt: next.completedAt ?? now,
      };
      await db.runAsync(
        'INSERT OR REPLACE INTO local_completed_tasks (id, json, completed_at, cached_order, updated_at) VALUES (?, ?, ?, 0, ?)',
        completed.id,
        JSON.stringify(completed),
        completed.completedAt,
        now,
      );
    } else {
      await db.runAsync('DELETE FROM local_completed_tasks WHERE id = ?', id);
    }

    const detailRow = await db.getFirstAsync<JsonRow>('SELECT json FROM local_task_details WHERE id = ?', id);
    const detail = detailRow ? parseJson<CachedTaskDetail>(detailRow.json) : null;
    if (detail) {
      await db.runAsync(
        'UPDATE local_task_details SET json = ?, updated_at = ? WHERE id = ?',
        JSON.stringify({ ...detail, task: next }),
        now,
        id,
      );
    }
  });
  return next;
}

export async function removeLocalTask(id: string): Promise<void> {
  const db = await initLocalDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM local_tasks WHERE id = ?', id);
    await db.runAsync('DELETE FROM local_completed_tasks WHERE id = ?', id);
    await db.runAsync('DELETE FROM local_task_details WHERE id = ?', id);
  });
}

export async function getTasksSyncedAt(): Promise<string | null> {
  return getSyncMeta(TASKS_SYNC_KEY);
}

async function getSyncMeta(key: string): Promise<string | null> {
  const db = await initLocalDb();
  const row = await db.getFirstAsync<MetaRow>('SELECT value FROM sync_meta WHERE key = ?', key);
  return row?.value ?? null;
}

async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await initLocalDb();
  await setSyncMetaInDb(db, key, value);
}

async function setSyncMetaInDb(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', key, value);
}

async function upsertCachedTaskInDb(db: SQLite.SQLiteDatabase, task: TaskView, now: string): Promise<void> {
  const row = await db.getFirstAsync<OrderRow>('SELECT cached_order FROM local_tasks WHERE id = ?', task.id);
  await db.runAsync(
    'INSERT OR REPLACE INTO local_tasks (id, json, cached_order, updated_at) VALUES (?, ?, ?, ?)',
    task.id,
    JSON.stringify(task),
    row?.cached_order ?? 0,
    now,
  );
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
