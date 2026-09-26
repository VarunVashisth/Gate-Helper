import { DatabaseSync } from 'node:sqlite';
import { parentPort } from 'node:worker_threads';
import { migrations } from './migrations';

type WorkerRequest = {
  id: number;
  operation:
    | 'initialize'
    | 'get-settings'
    | 'update-settings'
    | 'record-list'
    | 'record-get'
    | 'record-put'
    | 'record-delete'
    | 'backup'
    | 'close';
  payload?: Record<string, unknown>;
};

let database: DatabaseSync | undefined;

const assertDatabase = () => {
  if (!database) throw new Error('Database has not been initialized.');
  return database;
};

const initialize = (databasePath: string) => {
  database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const currentVersion = Number(database.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(migration.sql);
      database.exec(`PRAGMA user_version = ${migration.version};`);
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }

  return { ready: true };
};

const getSettings = () => {
  const rows = assertDatabase()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map(({ key, value }) => [key, JSON.parse(value)]));
};

const updateSettings = (patch: Record<string, unknown>) => {
  const db = assertDatabase();
  const statement = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  db.exec('BEGIN IMMEDIATE;');
  try {
    for (const [key, value] of Object.entries(patch)) {
      statement.run(key, JSON.stringify(value));
    }
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  return getSettings();
};

const recordList = (kind: string) =>
  assertDatabase()
    .prepare('SELECT data_json FROM records WHERE kind = ? ORDER BY updated_at DESC')
    .all(kind)
    .map((row) => JSON.parse(String(row.data_json)) as unknown);

const recordGet = (kind: string, id: string) => {
  const row = assertDatabase()
    .prepare('SELECT data_json FROM records WHERE kind = ? AND id = ?')
    .get(kind, id);
  return row ? JSON.parse(String(row.data_json)) : null;
};

const recordPut = (kind: string, id: string, value: unknown) => {
  assertDatabase()
    .prepare(`
      INSERT INTO records (kind, id, data_json, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(kind, id) DO UPDATE
      SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
    `)
    .run(kind, id, JSON.stringify(value));
  return value;
};

const recordDelete = (kind: string, id: string) => {
  assertDatabase().prepare('DELETE FROM records WHERE kind = ? AND id = ?').run(kind, id);
  return { deleted: true };
};

const backup = (targetPath: string) => {
  const db = assertDatabase();
  db.exec('PRAGMA wal_checkpoint(FULL);');
  db.prepare('VACUUM INTO ?').run(targetPath);
  return { created: true };
};

parentPort?.on('message', (request: WorkerRequest) => {
  try {
    let result: unknown;
    switch (request.operation) {
      case 'initialize':
        result = initialize(String(request.payload?.databasePath));
        break;
      case 'get-settings':
        result = getSettings();
        break;
      case 'update-settings':
        result = updateSettings(request.payload ?? {});
        break;
      case 'record-list':
        result = recordList(String(request.payload?.kind));
        break;
      case 'record-get':
        result = recordGet(String(request.payload?.kind), String(request.payload?.id));
        break;
      case 'record-put':
        result = recordPut(String(request.payload?.kind), String(request.payload?.id), request.payload?.value);
        break;
      case 'record-delete':
        result = recordDelete(String(request.payload?.kind), String(request.payload?.id));
        break;
      case 'backup':
        result = backup(String(request.payload?.targetPath));
        break;
      case 'close':
        database?.close();
        database = undefined;
        result = { closed: true };
        break;
    }
    parentPort?.postMessage({ id: request.id, result });
  } catch (error) {
    parentPort?.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});
