import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // user, admin, moderator
  isActive: boolean("is_active").notNull().default(true),
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
  aiContext: text("ai_context"),
  aiConfidence: integer("ai_confidence").default(0), // 0-100
  gameInfo: jsonb("game_info").$type<{
    homeTeam: string;
    awayTeam: string;
    quarter?: string;
    inning?: string;
    period?: string;
    status: string;
  }>().notNull(),
  weatherData: jsonb("weather_data").$type<{
    temperature: number;
    condition: string;
    windSpeed?: number;
    windDirection?: string;
  }>(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sentToTelegram: boolean("sent_to_telegram").notNull().default(false),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(),
  alertTypes: jsonb("alert_types").$type<{
    risp: boolean;
    homeRun: boolean;
    lateInning: boolean;
    redZone: boolean;
    clutchTime: boolean;
  }>().notNull(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  aiConfidenceThreshold: integer("ai_confidence_threshold").notNull().default(85),
  telegramEnabled: boolean("telegram_enabled").notNull().default(true),
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(true),
  
  // MLB Alert Toggles
  gameStateAlerts: boolean("game_state_alerts").notNull().default(true),
  rispAlerts: boolean("risp_alerts").notNull().default(true),
  weatherAlerts: boolean("weather_alerts").notNull().default(true),
  batterAlerts: boolean("batter_alerts").notNull().default(true),
  
  // NFL Alert Toggles
  redZoneAlerts: boolean("red_zone_alerts").notNull().default(true),
  twoMinuteAlerts: boolean("two_minute_alerts").notNull().default(true),
  fourthDownAlerts: boolean("fourth_down_alerts").notNull().default(true),
  turnoverAlerts: boolean("turnover_alerts").notNull().default(true),
  
  // NBA Alert Toggles
  clutchTimeAlerts: boolean("clutch_time_alerts").notNull().default(true),
  overtimeAlerts: boolean("overtime_alerts").notNull().default(true),
  leadChangeAlerts: boolean("lead_change_alerts").notNull().default(true),
  closeGameAlerts: boolean("close_game_alerts").notNull().default(true),
  
  // NHL Alert Toggles
  powerPlayAlerts: boolean("power_play_alerts").notNull().default(true),
  emptyNetAlerts: boolean("empty_net_alerts").notNull().default(true),
  thirdPeriodAlerts: boolean("third_period_alerts").notNull().default(true),
  finalMinutesAlerts: boolean("final_minutes_alerts").notNull().default(true),
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

// Learning content for each sport with admin management
export const sportLearning = pgTable("sport_learning", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(), // MLB, NFL, NBA, NHL
  category: text("category").notNull(), // alerts, strategies, rules, analysis
  title: text("title").notNull(),
  content: text("content").notNull(),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  tags: jsonb("tags").$type<string[]>().default([]),
  difficulty: text("difficulty").notNull().default("beginner"), // beginner, intermediate, advanced
  estimatedReadTime: integer("estimated_read_time").default(5), // in minutes
  isPublished: boolean("is_published").notNull().default(false),
  authorId: varchar("author_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User permissions for fine-grained access control
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(), // manage_users, manage_content, view_analytics, etc.
  resource: text("resource"), // specific resource like 'mlb', 'alerts', etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin activity logs
export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: varchar("resource_id"),
  details: jsonb("details").$type<Record<string, any>>(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  timestamp: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export const insertUserMonitoredTeamSchema = createInsertSchema(userMonitoredTeams).omit({
  id: true,
  createdAt: true,
});

export const insertSportLearningSchema = createInsertSchema(sportLearning).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
});

export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({
  id: true,
  timestamp: true,
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
export type InsertSportLearning = z.infer<typeof insertSportLearningSchema>;
export type SportLearning = typeof sportLearning.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;

// Additional game types for live sports data

// Game types for live sports data
export interface Game {
  id: string;
  sport: string;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
  };
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  venue?: string;
  isSelected?: boolean;
}

export interface GameDay {
  date: string;
  games: Game[];
}
