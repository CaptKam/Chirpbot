import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  email: text("email").unique(),
  password: text("password"),
  // OAuth fields
  googleId: text("google_id").unique(),
  appleId: text("apple_id").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImage: text("profile_image"),
  // Authentication method tracking
  authMethod: text("auth_method").notNull().default("local"), // 'local', 'google', 'apple'
  emailVerified: boolean("email_verified").notNull().default(false),
  // Admin role system
  role: text("role").notNull().default("user"), // 'admin', 'manager', 'analyst', 'user'
  // Individual Telegram configuration
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  telegramEnabled: boolean("telegram_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  sport: text("sport").notNull(),
  logoColor: text("logo_color").notNull().default("#1D2E5F"),
  monitored: boolean("monitored").notNull().default(false),
  externalId: text("external_id"),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // RISP, RedZone, ClutchTime, etc.
  sport: text("sport").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: integer("priority").default(70), // Alert priority (70-100)
  gameInfo: jsonb("game_info").$type<{
    homeTeam: string;
    awayTeam: string;
    quarter?: string;
    inning?: string;
    period?: string;
    status: string;
    // Enhanced MLB-specific data for rich notifications
    inningState?: 'top' | 'bottom';
    outs?: number;
    balls?: number;
    strikes?: number;
    runners?: {
      first: boolean;
      second: boolean;
      third: boolean;
    };
    score?: {
      home: number;
      away: number;
    };
    priority?: number;
    scoringProbability?: number;
    currentBatter?: {
      id: number;
      name: string;
      batSide: string;
      stats: {
        avg: number;
        hr: number;
        rbi: number;
        obp: number;
        ops: number;
        slg: number;
      };
    };
    currentPitcher?: {
      id: number;
      name: string;
      throwHand: string;
      stats: {
        era: number;
        whip: number;
        strikeOuts: number;
        wins: number;
        losses: number;
      };
    };
    // Add missing count property for alerts UI
    count?: {
      balls: number;
      strikes: number;
    };
  }>().notNull(),
  weatherData: jsonb("weather_data").$type<{
    temperature: number;
    condition: string;
    windSpeed?: number;
    windDirection?: string;
  }>(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sentToTelegram: boolean("sent_to_telegram").notNull().default(false),
  seen: boolean("seen").notNull().default(false),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(),
  alertTypes: jsonb("alert_types").$type<{
    // MLB Alert Types - Game Situations
    risp: boolean;
    basesLoaded: boolean;      // FIXED: Was missing
    runnersOnBase: boolean;
    closeGame: boolean;
    lateInning: boolean;        // FIXED: Kept as singular to match engine
    extraInnings: boolean;      // FIXED: Was missing
    
    // MLB Alert Types - Scoring Events
    homeRun: boolean;
    homeRunAlert: boolean;
    hits: boolean;
    scoring: boolean;
    inningChange: boolean;
    
    // MLB Alert Types - Player Performance  
    strikeouts: boolean;
    powerHitter: boolean;       // FIXED: Was missing
    powerHitterOnDeck: boolean;
    starBatter: boolean;        // FIXED: Was missing
    eliteClutch: boolean;       // FIXED: Was missing
    avgHitter: boolean;         // FIXED: Was missing
    rbiMachine: boolean;        // FIXED: Was missing
    
    // RE24 System removed
    
    // NFL Alert Types  
    redZone: boolean;
    nflCloseGame: boolean;
    fourthDown: boolean;
    twoMinuteWarning: boolean;
    
    // NBA Alert Types
    clutchTime: boolean;
    nbaCloseGame: boolean;
    overtime: boolean;
    
    // NHL Alert Types
    powerPlay: boolean;
    nhlCloseGame: boolean;
    emptyNet: boolean;
    
    // NCAAF (College Football) Alert Types
    ncaafRedZone: boolean;
    ncaafFourthDown: boolean;
    ncaafTwoMinuteWarning: boolean;
    ncaafCloseGame: boolean;
    ncaafOvertime: boolean;
    ncaafGoalLineStand: boolean;
    ncaafBigPlayPotential: boolean;
    ncaafGameLive: boolean;
  }>().notNull(),
  telegramEnabled: boolean("telegram_enabled").notNull().default(false),
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(false),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
});

// User monitored teams for persistent game selection
export const userMonitoredTeams = pgTable("user_monitored_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(), // The game ID from live sports API
  sport: text("sport").notNull(),
  homeTeamName: text("home_team_name").notNull(),
  awayTeamName: text("away_team_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  googleId: true,
  appleId: true,
  firstName: true,
  lastName: true,
  profileImage: true,
  authMethod: true,
}).extend({
  // Make fields flexible for different auth methods
  usernameOrEmail: z.string().optional(),
}).partial().refine(
  (data) => {
    // At least username, email, googleId, or appleId must be provided
    return data.username || data.email || data.googleId || data.appleId || data.usernameOrEmail;
  },
  {
    message: "At least one identifier (username, email, Google ID, or Apple ID) is required",
  }
);

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  timestamp: true,
  seen: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export const insertUserMonitoredTeamSchema = createInsertSchema(userMonitoredTeams).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export type InsertUserMonitoredTeam = z.infer<typeof insertUserMonitoredTeamSchema>;
export type UserMonitoredTeam = typeof userMonitoredTeams.$inferSelect;

export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;

export type InsertAiLearningLog = z.infer<typeof insertAiLearningLogSchema>;
export type AiLearningLog = typeof aiLearningLogs.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertMasterAlertControl = z.infer<typeof insertMasterAlertControlSchema>;
export type MasterAlertControl = typeof masterAlertControls.$inferSelect;

// Game types for live sports data
export interface Game {
  id: string;
  sport: string;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score?: number;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score?: number;
  };
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  venue?: string;
  isSelected?: boolean;
  isLive?: boolean;
  isCompleted?: boolean;
  // MLB-specific fields
  inning?: number;
  inningState?: string;
  gameState?: string;
  gamePk?: number;
}

export interface GameDay {
  date: string;
  games: Game[];
}

// Admin-specific tables for AI control and learning

// AI Settings per sport for fine-tuned control
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(), // MLB, NFL, NBA, NHL
  enabled: boolean("enabled").notNull().default(false),
  dryRun: boolean("dry_run").notNull().default(true),
  rateLimitMs: integer("rate_limit_ms").notNull().default(30000),
  minProbability: integer("min_probability").notNull().default(65), // 0-100 scale for easier UI
  inningThreshold: integer("inning_threshold").notNull().default(6),
  allowTypes: jsonb("allow_types").$type<string[]>().notNull().default([]),
  redactPii: boolean("redact_pii").notNull().default(true),
  model: text("model").notNull().default("gpt-4o-mini"),
  maxTokens: integer("max_tokens").default(500),
  temperature: integer("temperature").notNull().default(70), // 0-100 scale
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Learning Logs to track all AI interactions
export const aiLearningLogs = pgTable("ai_learning_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(),
  alertType: text("alert_type").notNull(),
  gameId: text("game_id"),
  inputData: jsonb("input_data").$type<{
    gameInfo: any;
    weatherData?: any;
    playerStats?: any;
    situationalData?: any;
    originalAlert: {
      type: string;
      title: string;
      description: string;
      confidence: number;
    };
  }>().notNull(),
  aiResponse: jsonb("ai_response").$type<{
    enhancedTitle?: string;
    enhancedDescription?: string;
    confidence: number;
    reasoning: string;
    tags: string[];
    priority: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    tokensUsed: number;
    processingTimeMs: number;
  }>(),
  success: boolean("success").notNull().default(false),
  errorMessage: text("error_message"),
  confidence: integer("confidence"), // AI-determined confidence 0-100
  userFeedback: integer("user_feedback"), // User rating 1-5 stars
  userFeedbackText: text("user_feedback_text"),
  settings: jsonb("settings").$type<{
    model: string;
    temperature: number;
    maxTokens: number;
    redactPii: boolean;
  }>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Master Alert Controls - Admin can globally enable/disable alert types
export const masterAlertControls = pgTable("master_alert_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertKey: text("alert_key").notNull(), // e.g., "basesLoaded", "redZone", "clutchTime"
  sport: text("sport").notNull(), // MLB, NFL, NBA, NHL
  enabled: boolean("enabled").notNull().default(true),
  displayName: text("display_name").notNull(), // e.g., "Bases Loaded", "Red Zone Alert"
  description: text("description"), // Optional description for admin reference
  category: text("category").notNull(), // e.g., "Game Situations", "Player Performance"
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Audit logs for admin actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // 'update_ai_settings', 'view_logs', 'feedback_submitted', etc.
  resource: text("resource").notNull(), // 'ai_settings', 'ai_logs', 'alerts', etc.
  resourceId: text("resource_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  metadata: jsonb("metadata").$type<{
    sport?: string;
    userAgent?: string;
    ip?: string;
    sessionId?: string;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for admin tables
export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertAiLearningLogSchema = createInsertSchema(aiLearningLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertMasterAlertControlSchema = createInsertSchema(masterAlertControls).omit({
  id: true,
  updatedAt: true,
});
