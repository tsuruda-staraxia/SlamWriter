CREATE TABLE IF NOT EXISTS riffs (
  id         TEXT PRIMARY KEY,
  user       TEXT NOT NULL,
  title      TEXT NOT NULL,
  data       TEXT NOT NULL,      -- packed song JSON
  token_hash TEXT NOT NULL,      -- sha-256 of the saver's browser token (needed to delete)
  ip_hash    TEXT NOT NULL,      -- sha-256 of the saver's IP, only used for rate limiting
  created_at INTEGER NOT NULL    -- unix ms
);
CREATE INDEX IF NOT EXISTS riffs_created ON riffs (created_at DESC);
CREATE INDEX IF NOT EXISTS riffs_ip ON riffs (ip_hash, created_at);
