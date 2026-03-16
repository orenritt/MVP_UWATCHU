-- UWATCHU Database Schema

-- Charities table (must exist before commitments reference it)
CREATE TABLE charities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stripe_account_id text,
  logo_url text,
  active boolean DEFAULT true
);

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  stripe_customer_id text,
  re_engagement_commitment_id uuid,
  re_engagement_touch int DEFAULT 0,
  re_engagement_window_closes_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Commitments table
CREATE TABLE commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  goal_text text NOT NULL,
  goal_parsed jsonb,
  verification_method text NOT NULL,
  cadence jsonb NOT NULL,
  failure_modes jsonb NOT NULL,
  stake_amount int NOT NULL,
  charity_id uuid REFERENCES charities(id),
  stripe_payment_intent_id text,
  stripe_setup_intent_id text,
  status text DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'active', 'completed', 'failed', 'cancelled')),
  is_public boolean DEFAULT false,
  slug text UNIQUE,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  conversation_state jsonb
);

-- Add foreign key for re_engagement_commitment_id after commitments exists
ALTER TABLE users
  ADD CONSTRAINT fk_re_engagement_commitment
  FOREIGN KEY (re_engagement_commitment_id) REFERENCES commitments(id);

-- Proofs table
CREATE TABLE proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid REFERENCES commitments(id) NOT NULL,
  period_id text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text NOT NULL,
  gps_lat float,
  gps_lng float,
  browser_timestamp timestamp with time zone,
  perceptual_hash text,
  status text DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'approved', 'flagged', 'rejected')),
  flagged_reason text
);

-- Reminders table
CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid REFERENCES commitments(id) NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Misses table
CREATE TABLE misses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid REFERENCES commitments(id) NOT NULL,
  missed_date date NOT NULL,
  period_id text,
  consecutive_count int DEFAULT 1,
  triggered_failure boolean DEFAULT false
);

-- Indexes
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_commitments_user ON commitments(user_id);
CREATE INDEX idx_commitments_slug ON commitments(slug);
CREATE INDEX idx_commitments_status ON commitments(status);
CREATE INDEX idx_proofs_commitment ON proofs(commitment_id);
CREATE INDEX idx_reminders_commitment ON reminders(commitment_id);
CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_for);
CREATE INDEX idx_misses_commitment ON misses(commitment_id);

-- Seed charities
INSERT INTO charities (name, description, active) VALUES
  ('Doctors Without Borders', 'International medical humanitarian organization', true),
  ('American Red Cross', 'Humanitarian organization providing emergency assistance', true),
  ('World Wildlife Fund', 'International conservation organization', true),
  ('Feeding America', 'Nationwide network of food banks', true),
  ('UNICEF', 'United Nations Children''s Fund', true);
