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


export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(),
  preferences: jsonb("preferences").$type<{
    notifications: boolean;
    theme: string;
  }>().notNull(),
  telegramEnabled: boolean("telegram_enabled").notNull().default(false),
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(false),
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


export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export type InsertUserMonitoredTeam = z.infer<typeof insertUserMonitoredTeamSchema>;
export type UserMonitoredTeam = typeof userMonitoredTeams.$inferSelect;

// User alert preferences for individual alert types
export const userAlertPreferences = pgTable("user_alert_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sport: text("sport").notNull(), // MLB, NFL, NBA, NHL
  alertType: text("alert_type").notNull(), // RISP, CLOSE_GAME, etc.
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserAlertPreferencesSchema = createInsertSchema(userAlertPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserAlertPreferences = z.infer<typeof insertUserAlertPreferencesSchema>;
export type UserAlertPreferences = typeof userAlertPreferences.$inferSelect;


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

// Admin-specific tables for ChirpBot Back Office
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'RULE_UPDATE', 'ALERT_ACK', 'ALERT_MUTE', 'SETTINGS_UPDATE'
  subjectId: varchar("subject_id"), // ID of the entity being acted upon
  before: jsonb("before"), // State before the action
  after: jsonb("after"), // State after the action
  ip: text("ip"),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const healthSnapshots = pgTable("health_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  component: text("component").notNull(), // 'statsapi', 'espn', 'weather', 'telegram', 'queue', 'worker'
  status: text("status").notNull(), // 'UP', 'DEGRADED', 'DOWN'
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminActions = pgTable("admin_actions", {
  idempotencyKey: varchar("idempotency_key").primaryKey(),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rules = pgTable("rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(), // 'MLB', 'NFL', 'NBA', 'NHL'
  key: text("key").notNull().unique(), // 'RE24_L1', 'RISP', etc.
  enabled: boolean("enabled").notNull().default(true),
  params: jsonb("params").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Enhanced alerts table status for admin management
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: text("game_id").notNull(),
  sport: text("sport").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("OPEN"), // 'OPEN', 'MUTED', 'ACKED', 'RESENT'
  payload: jsonb("payload").notNull(),
  source: text("source"), // which engine/source generated this
  priority: integer("priority").notNull().default(50), // 0-100, higher = more important
  confidence: integer("confidence").notNull().default(80), // AI confidence rating
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin schema extensions
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertHealthSnapshotSchema = createInsertSchema(healthSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertAdminActionSchema = createInsertSchema(adminActions).omit({
  createdAt: true,
});

export const insertRuleSchema = createInsertSchema(rules).omit({
  id: true,
  updatedAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Admin types
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertHealthSnapshot = z.infer<typeof insertHealthSnapshotSchema>;
export type HealthSnapshot = typeof healthSnapshots.$inferSelect;

export type InsertAdminAction = z.infer<typeof insertAdminActionSchema>;
export type AdminAction = typeof adminActions.$inferSelect;

export type InsertRule = z.infer<typeof insertRuleSchema>;
export type Rule = typeof rules.$inferSelect;

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;


