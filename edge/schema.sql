-- The entire database. Five tables, no personal data anywhere.
CREATE TABLE IF NOT EXISTS installs (
  id          TEXT PRIMARY KEY,          -- inst_xxxxxx, one per PLATFORM
  domain      TEXT NOT NULL,
  verified_at TEXT,                       -- set by DNS/meta verification
  version     TEXT,
  last_seen   TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agg (
  key     TEXT NOT NULL,                  -- install|variant|format|trigger|bucket|outcome|route
  day     TEXT NOT NULL,                  -- YYYY-MM-DD (calendar day only, eliminating hourly correlation)
  install TEXT NOT NULL,
  variant TEXT NOT NULL,
  format  TEXT NOT NULL,
  trigger TEXT NOT NULL,
  bucket  TEXT NOT NULL,
  outcome TEXT NOT NULL,                  -- clicked_help | dismissed | left_page | continued | timeout
  route   TEXT NOT NULL,                  -- route id served, or 'xx-none'
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
);
CREATE INDEX IF NOT EXISTS idx_agg_install_day ON agg(install, day);

CREATE TABLE IF NOT EXISTS arrivals (
  install   TEXT NOT NULL,
  service   TEXT NOT NULL,                -- e.g. nl-offlimits
  month     TEXT NOT NULL,                -- YYYY-MM
  count     INTEGER NOT NULL,
  reported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (install, service, month)
);

CREATE TABLE IF NOT EXISTS heartbeats (
  install TEXT PRIMARY KEY,
  version TEXT,
  at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trigger_packs (
  version    TEXT PRIMARY KEY,
  bundle     TEXT NOT NULL,              -- signed blob, verified installs only
  published  TEXT NOT NULL,
  min_client TEXT
);
