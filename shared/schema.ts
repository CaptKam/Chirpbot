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
    // MLB Alert Types
    risp: boolean;
    homeRun: boolean;
    lateInning: boolean;
    closeGame: boolean;
    runnersOnBase: boolean;
    hits: boolean;
    scoring: boolean;
    inningChange: boolean;
    homeRunAlert: boolean;
    strikeouts: boolean;
    
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
  }>().notNull(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  aiConfidenceThreshold: integer("ai_confidence_threshold").notNull().default(85),
  telegramEnabled: boolean("telegram_enabled").notNull().default(true),
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(true),
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
