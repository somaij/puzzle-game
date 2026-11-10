-- One row per event. Deliberately no IP address, browser details, player ID or time of day.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  received_on TEXT NOT NULL DEFAULT (date('now')),
  event TEXT NOT NULL,
  puzzle INTEGER NOT NULL,
  -- The rest are only set on puzzle-finish.
  result TEXT,
  score INTEGER,
  misses INTEGER,
  top_speed REAL,
  seconds_per_piece REAL,
  islands INTEGER,
  streak INTEGER
);
