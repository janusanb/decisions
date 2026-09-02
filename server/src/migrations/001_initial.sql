CREATE TABLE participants (
  id TEXT PRIMARY KEY CHECK (id IN ('a', 'b')),
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE UNIQUE INDEX restaurants_name_nocase
  ON restaurants (name COLLATE NOCASE)
  WHERE archived_at IS NULL;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN ('open', 'revealed', 'spun', 'confirmed', 'rejected', 'cancelled')
  ),
  created_at TEXT NOT NULL,
  revealed_at TEXT,
  spun_at TEXT,
  resolved_at TEXT,
  result_restaurant_id TEXT REFERENCES restaurants (id),
  previous_result_restaurant_id TEXT REFERENCES restaurants (id),
  rotation_degrees REAL,
  created_by TEXT NOT NULL CHECK (created_by IN ('a', 'b'))
);

CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants (id),
  visited_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('confirmed_spin', 'manual')),
  session_id TEXT REFERENCES sessions (id),
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX visits_restaurant_visited ON visits (restaurant_id, visited_at DESC);
CREATE INDEX visits_visited_at ON visits (visited_at DESC);

CREATE TABLE submissions (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL CHECK (participant_id IN ('a', 'b')),
  locked_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, participant_id)
);

CREATE TABLE submission_choices (
  session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES restaurants (id),
  PRIMARY KEY (session_id, participant_id, restaurant_id),
  FOREIGN KEY (session_id, participant_id)
    REFERENCES submissions (session_id, participant_id)
    ON DELETE CASCADE
);

CREATE TABLE spin_candidates (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES restaurants (id),
  tickets INTEGER NOT NULL,
  slice_start_degrees REAL NOT NULL,
  slice_angle_degrees REAL NOT NULL,
  PRIMARY KEY (session_id, restaurant_id)
);

INSERT INTO participants (id, name, updated_at) VALUES
  ('a', 'Person A', '1970-01-01T00:00:00.000Z'),
  ('b', 'Person B', '1970-01-01T00:00:00.000Z');
