-- Taraney schema v1. Timing is line level only (sync_level 0 none, 1 line).
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft','review','published','rejected')),
  reviewed INTEGER NOT NULL DEFAULT 0,
  title_ur TEXT,
  title_ro TEXT,
  genre TEXT,
  themes TEXT NOT NULL DEFAULT '[]',
  mood TEXT,
  mood_locked INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'ur',
  poet_ur TEXT,
  poet_ro TEXT,
  singer TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  doc TEXT NOT NULL DEFAULT '{"sections":[],"structure":[],"notes":[]}',
  artwork_key TEXT,
  source_pages TEXT NOT NULL DEFAULT '[]',
  review_reason TEXT,
  issues TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX songs_state ON songs(publish_state);

CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('audio','youtube')),
  audio_key TEXT,
  youtube_id TEXT,
  source_url TEXT,
  label TEXT,
  duration_ms INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 1,
  sync_level INTEGER NOT NULL DEFAULT 0 CHECK (sync_level IN (0,1)),
  timing_source TEXT,
  structure TEXT,
  lines TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX recordings_song ON recordings(song_id);

CREATE TABLE song_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT,
  input TEXT NOT NULL DEFAULT '{}',
  result TEXT,
  error TEXT,
  song_id TEXT,
  token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  secret_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE login_attempts (
  key TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX login_attempts_key ON login_attempts(key, at);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  song_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
