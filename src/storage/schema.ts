/**
 * Database Schema
 * 
 * PostgreSQL schema for the contribution motivation app
 * Stores aggregated data, not raw events
 */

export const SCHEMA = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Installations table
CREATE TABLE IF NOT EXISTS installations (
  installation_id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  account_login VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('Organization', 'User')),
  settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installations_account_login ON installations(account_login);
CREATE INDEX IF NOT EXISTS idx_installations_is_active ON installations(is_active);

-- Users table (cache of GitHub user data)
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  login VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  user_type VARCHAR(50) NOT NULL DEFAULT 'User',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

-- Daily contributions table (aggregated per user per org per day)
CREATE TABLE IF NOT EXISTS daily_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_login VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  commits INTEGER NOT NULL DEFAULT 0,
  lines_added INTEGER NOT NULL DEFAULT 0,
  lines_removed INTEGER NOT NULL DEFAULT 0,
  pull_requests_merged INTEGER NOT NULL DEFAULT 0,
  issues_closed INTEGER NOT NULL DEFAULT 0,
  issues_opened INTEGER NOT NULL DEFAULT 0,
  repositories_contributed INTEGER[] NOT NULL DEFAULT '{}',
  raw_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  weighted_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_contributions_org_id ON daily_contributions(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_contributions_user_id ON daily_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_contributions_date ON daily_contributions(date);
CREATE INDEX IF NOT EXISTS idx_daily_contributions_org_user_date ON daily_contributions(org_id, user_id, date);

-- Aggregated stats table (pre-computed period aggregates)
CREATE TABLE IF NOT EXISTS aggregated_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_login VARCHAR(255) NOT NULL,
  user_avatar_url TEXT,
  period VARCHAR(20) NOT NULL CHECK (period IN ('7d', '30d', '90d', 'monthly', 'all-time')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_commits INTEGER NOT NULL DEFAULT 0,
  total_lines_added INTEGER NOT NULL DEFAULT 0,
  total_lines_removed INTEGER NOT NULL DEFAULT 0,
  total_pull_requests_merged INTEGER NOT NULL DEFAULT 0,
  total_issues_closed INTEGER NOT NULL DEFAULT 0,
  total_issues_opened INTEGER NOT NULL DEFAULT 0,
  unique_repositories INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  raw_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  weighted_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  rank VARCHAR(20) NOT NULL DEFAULT 'Bronze',
  active_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_aggregated_stats_org_id ON aggregated_stats(org_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_stats_org_period ON aggregated_stats(org_id, period);
CREATE INDEX IF NOT EXISTS idx_aggregated_stats_weighted_score ON aggregated_stats(weighted_score DESC);

-- Streaks table
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_login VARCHAR(255) NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_contribution_date DATE,
  streak_start_date DATE,
  longest_streak_start_date DATE,
  longest_streak_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_streaks_org_id ON streaks(org_id);
CREATE INDEX IF NOT EXISTS idx_streaks_current_streak ON streaks(current_streak DESC);

-- Awards table
CREATE TABLE IF NOT EXISTS awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_login VARCHAR(255) NOT NULL,
  award_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  month VARCHAR(7) NOT NULL, -- YYYY-MM format
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(org_id, user_id, award_type, month)
);

CREATE INDEX IF NOT EXISTS idx_awards_org_id ON awards(org_id);
CREATE INDEX IF NOT EXISTS idx_awards_org_month ON awards(org_id, month);
CREATE INDEX IF NOT EXISTS idx_awards_user_id ON awards(user_id);

-- User privacy settings
CREATE TABLE IF NOT EXISTS user_privacy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_login VARCHAR(255) NOT NULL,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  hide_from_leaderboard BOOLEAN NOT NULL DEFAULT false,
  hide_score BOOLEAN NOT NULL DEFAULT false,
  hide_streak BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_privacy_org_id ON user_privacy(org_id);

-- Processed events (for idempotency tracking)
CREATE TABLE IF NOT EXISTS processed_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  delivery_id VARCHAR(255) NOT NULL UNIQUE,
  installation_id INTEGER NOT NULL,
  org_id INTEGER NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_processed_events_delivery_id ON processed_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at ON processed_events(processed_at);

-- Cleanup old processed events (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_events() RETURNS void AS $$
BEGIN
  DELETE FROM processed_events WHERE processed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_installations_updated_at ON installations;
CREATE TRIGGER update_installations_updated_at
    BEFORE UPDATE ON installations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_contributions_updated_at ON daily_contributions;
CREATE TRIGGER update_daily_contributions_updated_at
    BEFORE UPDATE ON daily_contributions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aggregated_stats_updated_at ON aggregated_stats;
CREATE TRIGGER update_aggregated_stats_updated_at
    BEFORE UPDATE ON aggregated_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_streaks_updated_at ON streaks;
CREATE TRIGGER update_streaks_updated_at
    BEFORE UPDATE ON streaks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_privacy_updated_at ON user_privacy;
CREATE TRIGGER update_user_privacy_updated_at
    BEFORE UPDATE ON user_privacy
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export default SCHEMA;
