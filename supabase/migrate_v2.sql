-- Adaptive State UI v2 Migration
-- Run this against an existing sessions table to add the new tracking columns.
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS click_targets jsonb DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hover_targets jsonb DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS funnel_stage text DEFAULT 'product_view';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS dropoff_stage text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scroll_depth int DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scroll_speed text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_on_price float DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS form_errors int DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_type text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS traffic_source text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS outcome_detail jsonb DEFAULT '{}';

-- New indexes
CREATE INDEX IF NOT EXISTS idx_sessions_funnel_stage ON sessions(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_sessions_traffic_source ON sessions(traffic_source);
