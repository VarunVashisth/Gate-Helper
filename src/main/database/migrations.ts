export const DATABASE_VERSION = 2;

export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('selectedOllamaModel', 'null'),
        ('sidebarCollapsed', 'false');

      CREATE TABLE IF NOT EXISTS papers (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS syllabus_nodes (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        position INTEGER NOT NULL,
        completed_at TEXT,
        notes TEXT,
        target_date TEXT,
        revision_priority INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS source_documents (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        display_name TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        sha256 TEXT NOT NULL UNIQUE,
        page_count INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        question_document_id TEXT NOT NULL REFERENCES source_documents(id),
        answer_document_id TEXT REFERENCES source_documents(id),
        status TEXT NOT NULL,
        warnings_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tests (
        id TEXT PRIMARY KEY,
        paper_id TEXT REFERENCES papers(id),
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        total_marks REAL NOT NULL,
        source_document_id TEXT REFERENCES source_documents(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        test_id TEXT NOT NULL REFERENCES tests(id),
        status TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        submitted_at TEXT,
        score REAL
      );

      CREATE TABLE IF NOT EXISTS study_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        due_at TEXT,
        completed_at TEXT,
        topic_id TEXT REFERENCES syllabus_nodes(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tutor_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tutor_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES tutor_threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        citations_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (kind, id)
      );
      CREATE INDEX IF NOT EXISTS idx_records_kind_updated
        ON records(kind, updated_at DESC);
    `,
  },
] as const;
