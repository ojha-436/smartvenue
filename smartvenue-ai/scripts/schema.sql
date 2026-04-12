-- =============================================================================
-- SmartVenue AI — Cloud SQL (PostgreSQL 16) Schema
-- Run this once after the Cloud SQL instance is provisioned:
--   psql -h <CLOUD_SQL_IP> -U smartvenue -d smartvenue -f schema.sql
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Venues ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  city         TEXT NOT NULL,
  country      TEXT NOT NULL DEFAULT 'IN',
  capacity     INTEGER NOT NULL,
  timezone     TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  config       JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Zones ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  zone_type     TEXT NOT NULL CHECK (zone_type IN ('entrance','seating','concourse','food','restroom','parking','exit','vip')),
  capacity      INTEGER NOT NULL,
  grid_row      INTEGER,
  grid_col      INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zones_venue ON zones(venue_id);

-- ── Staff ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('steward','supervisor','manager','security','medical')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_venue ON staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- ── Staff Sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON staff_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON staff_sessions(token_hash);

-- ── Amenities ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amenities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  zone_id       UUID REFERENCES zones(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  amenity_type  TEXT NOT NULL CHECK (amenity_type IN ('food_stall','restroom','atm','first_aid','merch_store','ticket_booth','parking_bay')),
  queue_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  avg_serve_secs INTEGER NOT NULL DEFAULT 120,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_amenities_venue ON amenities(venue_id);

-- ── Menu Items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amenity_id    UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price_paise   INTEGER NOT NULL,          -- price in paise (₹1 = 100 paise)
  category      TEXT NOT NULL,
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menu_amenity ON menu_items(amenity_id);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id),
  amenity_id    UUID NOT NULL REFERENCES amenities(id),
  attendee_uid  TEXT NOT NULL,              -- Firebase UID
  items         JSONB NOT NULL,             -- [{item_id, name, qty, price_paise}]
  total_paise   INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','preparing','ready','collected','cancelled')),
  notes         TEXT,
  placed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at      TIMESTAMPTZ,
  collected_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_venue     ON orders(venue_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_attendee  ON orders(attendee_uid);
CREATE INDEX IF NOT EXISTS idx_orders_amenity   ON orders(amenity_id, status);

-- ── Incidents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id),
  zone_id       UUID REFERENCES zones(id),
  reporter_id   UUID REFERENCES staff(id),
  severity      SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 3),
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved')),
  resolved_by   UUID REFERENCES staff(id),
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incidents_venue ON incidents(venue_id, reported_at DESC);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id),
  assigned_to   UUID REFERENCES staff(id),
  created_by    UUID REFERENCES staff(id),
  title         TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  due_at        TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_venue    ON tasks(venue_id, created_at DESC);

-- ── Gate Check-ins ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gate_checkins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id),
  zone_id       UUID REFERENCES zones(id),
  attendee_uid  TEXT NOT NULL,
  ticket_id     TEXT NOT NULL,
  gate_id       TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkins_venue   ON gate_checkins(venue_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_ticket  ON gate_checkins(ticket_id);

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Default seed venue (update as needed) ─────────────────────────────────────
INSERT INTO venues (id, name, city, capacity, timezone) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'National Sports Complex', 'New Delhi', 75000, 'Asia/Kolkata')
ON CONFLICT DO NOTHING;

INSERT INTO zones (venue_id, name, zone_type, capacity, grid_row, grid_col) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Gate A North',     'entrance',  5000, 0, 0),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Gate B South',     'entrance',  5000, 3, 0),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Gate C East',      'entrance',  5000, 0, 3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Gate D West',      'entrance',  5000, 3, 3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'North Stand',      'seating',  15000, 0, 1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'South Stand',      'seating',  15000, 3, 1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'East Stand',       'seating',  10000, 1, 3),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'West Stand',       'seating',  10000, 1, 0),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'VIP Enclosure',    'vip',       2000, 1, 1),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'North Concourse',  'concourse', 3000, 0, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'South Concourse',  'concourse', 3000, 3, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Food Court Alpha', 'food',      1500, 1, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Food Court Beta',  'food',      1500, 2, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Restrooms North',  'restroom',   500, 0, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Restrooms South',  'restroom',   500, 3, 2),
  ('a1b2c3d4-0000-0000-0000-000000000001', 'Parking Zone P1',  'parking',   2000, 4, 0)
ON CONFLICT DO NOTHING;
