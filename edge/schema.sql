-- The entire database. No personal data anywhere. Every table has a writer.
CREATE TABLE IF NOT EXISTS installs (
  id            TEXT PRIMARY KEY,          -- inst_xxxxxx, one per PLATFORM
  domain        TEXT NOT NULL,             -- exact host (no scheme, no wildcard); also the Door's frame-ancestors
  verified_at   TEXT,                      -- set by POST /v1/verify (meta tag or DNS TXT)
  verify_token  TEXT,                      -- the platform places this on its site
  desk_token_hash TEXT,                    -- sha-256 hex of the Desk bearer token
  daily_cap     INTEGER NOT NULL DEFAULT 5000,   -- accepted events per day, from declared traffic
  rate_per_min  INTEGER NOT NULL DEFAULT 120,    -- attempts per minute
  version       TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agg (
  key     TEXT NOT NULL,                  -- install|variant|format|trigger|bucket|outcome|route
  day     TEXT NOT NULL,                  -- YYYY-MM-DD (calendar day only, no hourly correlation)
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

-- Count of events a Door could not send. A number per install per day; nothing else.
CREATE TABLE IF NOT EXISTS heartbeats (
  install TEXT NOT NULL,
  day     TEXT NOT NULL,
  version TEXT NOT NULL,
  dropped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (install, day, version)
);

-- Content-free false-positive reports (docs/02 R7). Reason is a closed list.
CREATE TABLE IF NOT EXISTS reports (
  install TEXT NOT NULL,
  day     TEXT NOT NULL,
  pack    TEXT NOT NULL,
  trigger TEXT NOT NULL,
  reason  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (install, day, pack, trigger, reason)
);

-- Abuse limiter. 'm' rows (minute) are pruned within minutes so no per-minute
-- history persists; 'd' rows (day) are pruned after two days.
CREATE TABLE IF NOT EXISTS rate (
  k     TEXT PRIMARY KEY,
  kind  TEXT NOT NULL,                    -- 'm' | 'd'
  stamp TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0
);
