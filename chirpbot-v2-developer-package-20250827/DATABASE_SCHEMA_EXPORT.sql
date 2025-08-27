-- ChirpBot V2 Database Schema Export
-- Generated: August 25, 2025
-- Current Alert Status: 28 Total Alerts (26 Enabled) Across 4 Sports

-- Core application tables with complete relationships

-- Users table for authentication
CREATE TABLE users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE,
  email text UNIQUE, 
  password_hash text,
  google_id text UNIQUE,
  apple_id text UNIQUE,
  display_name text,
  profile_image text,
  auth_method text NOT NULL DEFAULT 'local',
  is_admin boolean DEFAULT false,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Teams table for MLB/NFL/NBA/NHL teams
CREATE TABLE teams (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL UNIQUE,
  sport text NOT NULL,
  logo_url text,
  primary_color text,
  secondary_color text
);

-- Alerts table for storing generated alerts
CREATE TABLE alerts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  title text NOT NULL,
  type text NOT NULL,
  sport text NOT NULL,
  game_id text,
  description text,
  priority integer DEFAULT 1,
  confidence integer,
  probability numeric(5,4),
  metadata jsonb,
  seen boolean DEFAULT false,
  timestamp timestamp DEFAULT NOW()
);

-- Settings table with all 28 alert type configurations
CREATE TABLE settings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  alert_types jsonb NOT NULL DEFAULT '{
    "risp": true,
    "homeRun": true,
    "lateInning": true,
    "closeGame": true, 
    "runnersOnBase": true,
    "hits": true,
    "scoring": true,
    "inningChange": false,
    "homeRunAlert": true,
    "strikeouts": false,
    "powerHitterOnDeck": true,
    "useRE24System": true,
    "re24Level1": true,
    "re24Level2": true,
    "re24Level3": true,
    "redZone": true,
    "nflCloseGame": true,
    "fourthDown": true,
    "twoMinuteWarning": true,
    "clutchTime": true,
    "nbaCloseGame": true,
    "overtime": true,
    "powerPlay": true,
    "nhlCloseGame": true,
    "emptyNet": true
  }',
  telegram_bot_token text,
  telegram_chat_id text,
  notifications_enabled boolean DEFAULT true,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- User monitored teams for persistent game selection
CREATE TABLE user_monitored_teams (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  game_id text NOT NULL,
  sport text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  game_date date NOT NULL,
  created_at timestamp DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Master alert controls (28 total records)
CREATE TABLE master_alert_controls (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  sport text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_name text NOT NULL,
  description text,
  category text NOT NULL,
  updated_by varchar REFERENCES users(id),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT unique_alert_sport UNIQUE (alert_key, sport)
);

-- AI settings for OpenAI integration
CREATE TABLE ai_settings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  enabled boolean DEFAULT false,
  dry_run boolean DEFAULT true,
  rate_limit_ms integer DEFAULT 30000,
  min_probability integer DEFAULT 65,
  inning_threshold integer DEFAULT 6,
  allow_types jsonb DEFAULT '[]',
  redact_pii boolean DEFAULT true,
  model text DEFAULT 'gpt-4o-mini',
  max_tokens integer DEFAULT 500,
  temperature integer DEFAULT 70,
  updated_by varchar,
  updated_at timestamp DEFAULT NOW()
);

-- AI learning logs for analysis tracking
CREATE TABLE ai_learning_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  alert_type text NOT NULL,
  game_id text,
  input_data jsonb NOT NULL,
  ai_response jsonb,
  success boolean DEFAULT false,
  error_message text,
  confidence integer,
  user_feedback integer,
  user_feedback_text text,
  settings jsonb NOT NULL,
  created_at timestamp DEFAULT NOW()
);

-- Audit logs for system tracking
CREATE TABLE audit_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamp DEFAULT NOW()
);

-- Current master alert controls data (28 total)
INSERT INTO master_alert_controls (sport, alert_key, display_name, description, category, enabled) VALUES
-- MLB Game Situations (6)
('MLB', 'risp', 'Runners In Scoring Position', 'Runners on 2nd/3rd base with potential to score', 'Game Situations', true),
('MLB', 'basesLoaded', 'Bases Loaded', 'All bases occupied - maximum run potential', 'Game Situations', true),
('MLB', 'closeGame', 'Close Game', 'Tight games within 3 runs in late innings', 'Game Situations', true),
('MLB', 'lateInnings', 'Late Innings', '7th inning and beyond - clutch time', 'Game Situations', true),
('MLB', 'extraInnings', 'Extra Innings', 'Games beyond 9 innings', 'Game Situations', true),
('MLB', 'runnersOnBase', 'Runners On Base', 'Any base runners - scoring opportunities', 'Game Situations', true),

-- MLB Player Performance (4)
('MLB', 'powerHitter', 'Power Hitter At Bat', 'Tier A power hitters currently batting', 'Player Performance', true),
('MLB', 'powerHitterOnDeck', 'Power Hitter On Deck', 'Tier A power bats on deck - Pre-alert for next at-bat', 'Player Performance', true),
('MLB', 'homeRun', 'Home Run Situations', 'Prime conditions for home run potential', 'Player Performance', true),
('MLB', 'homeRunAlert', 'Home Run Alert', 'Real-time home run notifications with Grand Slam detection', 'Player Performance', true),

-- MLB Specialized Alerts (4)
('MLB', 'hits', 'Hit Alerts', 'Base hit notifications - singles, doubles, triples', 'Player Performance', true),
('MLB', 'scoring', 'Scoring Play Alerts', 'RBI plays and run scoring notifications', 'Player Performance', true),
('MLB', 'strikeouts', 'Strikeout Alerts', 'Notable strikeout situations', 'Player Performance', false),
('MLB', 'inningChange', 'Inning Change', 'New inning notifications', 'Game Flow', false),

-- MLB AI System (4) 
('MLB', 'useRE24System', 'AI-Enhanced Alerts', 'Enable AI analysis for all alerts', 'AI System', true),
('MLB', 're24Level1', 'High Leverage (RE24 L1)', 'Moderate scoring probability situations', 'AI System', true),
('MLB', 're24Level2', 'Elite Leverage (RE24 L2)', 'High scoring probability situations', 'AI System', true),
('MLB', 're24Level3', 'Maximum Leverage (RE24 L3)', 'Extremely high scoring probability situations', 'AI System', true),

-- NFL Alerts (4)
('NFL', 'redZone', 'Red Zone Situations', 'Touchdown territory alerts', 'Game Situations', true),
('NFL', 'nflCloseGame', 'Close Game', 'One-score NFL games', 'Game Situations', true),
('NFL', 'fourthDown', 'Fourth Down', 'Critical 4th down decisions', 'Game Situations', true),
('NFL', 'twoMinuteWarning', 'Two Minute Warning', 'Crunch time alerts', 'Game Situations', true),

-- NBA Alerts (3)
('NBA', 'clutchTime', 'Clutch Time', 'Final 5 minutes in close games', 'Game Situations', true),
('NBA', 'nbaCloseGame', 'Close Game', 'Tight NBA contests', 'Game Situations', true),
('NBA', 'overtime', 'Overtime', 'Extra basketball periods', 'Game Situations', true),

-- NHL Alerts (3)
('NHL', 'powerPlay', 'Power Play', 'Man advantage opportunities', 'Game Situations', true),
('NHL', 'nhlCloseGame', 'Close Game', 'One-goal NHL games', 'Game Situations', true),
('NHL', 'emptyNet', 'Empty Net', 'Goalie pulled situations', 'Game Situations', true);

-- Database performance indexes
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX idx_alerts_type_sport ON alerts(type, sport);
CREATE INDEX idx_settings_user_id ON settings(user_id);
CREATE INDEX idx_monitored_teams_user_game ON user_monitored_teams(user_id, game_id);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action);

-- Current system statistics
-- Total alerts: 28 (26 enabled)
-- Sports covered: 4 (MLB, NFL, NBA, NHL) 
-- MLB alerts: 18 (most comprehensive)
-- Production ready with live game monitoring