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

// Alert types configuration for admin management
export const alertTypes = pgTable("alert_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "RISP", "CLOSE_GAME", "HOME_RUN_LIVE"
  sport: text("sport").notNull(), // MLB, NFL, NBA, NHL, etc.
  category: text("category").notNull(), // Game Situations, Scoring Events, etc.
  label: text("label").notNull(), // Human-readable name
  description: text("description").notNull(),
  enabledDefault: boolean("enabled_default").notNull().default(true),
  priority: integer("priority").notNull().default(50), // 0-100 priority scale
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User permissions for specific alert types (overrides defaults)
export const userAlertPermissions = pgTable("user_alert_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  alertTypeId: varchar("alert_type_id").notNull().references(() => alertTypes.id, { onDelete: "cascade" }),
  allowed: boolean("allowed").notNull(), // true -> user can use this alert type
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Game state tracking for live monitoring
export const gameStates = pgTable("game_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(), // MLB, NFL, NCAAF...
  extGameId: text("ext_game_id").notNull(), // external game id from feed
  status: text("status").notNull(), // SCHEDULED, LIVE, FINAL
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  clock: text("clock"), // "Q3 05:13" or "Top 7th, 1 out"
  startUtc: timestamp("start_utc"),
  payload: jsonb("payload").$type<any>(), // raw merged snapshot
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin activity log
export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // USER_PERMISSION_CHANGED, ALERT_TYPE_UPDATED, etc.
  details: jsonb("details").$type<any>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for new tables
export const insertAlertTypeSchema = createInsertSchema(alertTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAlertPermissionSchema = createInsertSchema(userAlertPermissions).omit({
  id: true,
  createdAt: true,
});

export const insertGameStateSchema = createInsertSchema(gameStates).omit({
  id: true,
  updatedAt: true,
});

export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({
  id: true,
  createdAt: true,
});

// Types for new tables
export type InsertAlertType = z.infer<typeof insertAlertTypeSchema>;
export type AlertType = typeof alertTypes.$inferSelect;

export type InsertUserAlertPermission = z.infer<typeof insertUserAlertPermissionSchema>;
export type UserAlertPermission = typeof userAlertPermissions.$inferSelect;

export type InsertGameState = z.infer<typeof insertGameStateSchema>;
export type GameState = typeof gameStates.$inferSelect;

export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;

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


