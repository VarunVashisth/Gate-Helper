// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { migrations } from '../../src/main/database/migrations';

let database: DatabaseSync | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe('database migrations', () => {
  it('can initialize the foundation schema more than once', () => {
    database = new DatabaseSync(':memory:');
    for (const migration of migrations) database.exec(migration.sql);
    for (const migration of migrations) database.exec(migration.sql);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name));

    expect(tables).toEqual(expect.arrayContaining(['settings', 'papers', 'syllabus_nodes', 'tests', 'attempts']));
  });
});

