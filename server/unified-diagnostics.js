var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// ../shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  alerts: () => alerts,
  gameStates: () => gameStates,
  globalAlertSettings: () => globalAlertSettings,
  insertAlertSchema: () => insertAlertSchema,
  insertGameStateSchema: () => insertGameStateSchema,
  insertGlobalAlertSettingsSchema: () => insertGlobalAlertSettingsSchema,
  insertSettingsSchema: () => insertSettingsSchema,
  insertTeamSchema: () => insertTeamSchema,
  insertUserAlertPreferencesSchema: () => insertUserAlertPreferencesSchema,
  insertUserMonitoredTeamSchema: () => insertUserMonitoredTeamSchema,
  insertUserSchema: () => insertUserSchema,
  settings: () => settings,
  teams: () => teams,
  userAlertPreferences: () => userAlertPreferences,
  userMonitoredTeams: () => userMonitoredTeams,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
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
  authMethod: text("auth_method").notNull().default("local"),
  // 'local', 'google', 'apple'
  emailVerified: boolean("email_verified").notNull().default(false),
  // Admin role system
  role: text("role").notNull().default("user"),
  // 'admin', 'manager', 'analyst', 'user'
  // Individual Telegram configuration
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  telegramEnabled: boolean("telegram_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  sport: text("sport").notNull(),
  logoColor: text("logo_color").notNull().default("#1D2E5F"),
  monitored: boolean("monitored").notNull().default(false),
  externalId: text("external_id")
});
var settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(),
  preferences: jsonb("preferences").$type().notNull(),
  telegramEnabled: boolean("telegram_enabled").notNull().default(false),
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(false)
});
var userMonitoredTeams = pgTable("user_monitored_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  // The game ID from live sports API
  sport: text("sport").notNull(),
  homeTeamName: text("home_team_name").notNull(),
  awayTeamName: text("away_team_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var globalAlertSettings = pgTable("global_alert_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: text("sport").notNull(),
  // MLB, NFL, NBA, NHL, etc.
  alertType: text("alert_type").notNull(),
  // RISP, BASES_LOADED, etc.
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id)
  // Admin who made the change
});
var alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertKey: varchar("alert_key").notNull(),
  sport: text("sport").notNull(),
  gameId: text("game_id").notNull(),
  type: text("type").notNull(),
  state: text("state").notNull(),
  score: integer("score").notNull().default(0),
  payload: jsonb("payload").notNull(),
  // Demo support columns
  isDemo: boolean("is_demo").notNull().default(false),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  googleId: true,
  appleId: true,
  firstName: true,
  lastName: true,
  profileImage: true,
  authMethod: true
}).extend({
  // Make fields flexible for different auth methods
  usernameOrEmail: z.string().optional()
}).partial().refine(
  (data) => {
    return data.username || data.email || data.googleId || data.appleId || data.usernameOrEmail;
  },
  {
    message: "At least one identifier (username, email, Google ID, or Apple ID) is required"
  }
);
var insertTeamSchema = createInsertSchema(teams).omit({
  id: true
});
var insertSettingsSchema = createInsertSchema(settings).omit({
  id: true
});
var insertUserMonitoredTeamSchema = createInsertSchema(userMonitoredTeams).omit({
  id: true,
  createdAt: true
});
var insertGlobalAlertSettingsSchema = createInsertSchema(globalAlertSettings).omit({
  id: true,
  updatedAt: true
});
var userAlertPreferences = pgTable("user_alert_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sport: text("sport").notNull(),
  // MLB, NFL, NBA, NHL
  alertType: text("alert_type").notNull(),
  // RISP, CLOSE_GAME, etc.
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertUserAlertPreferencesSchema = createInsertSchema(userAlertPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true
});
var gameStates = pgTable("game_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  extGameId: text("ext_game_id").notNull(),
  // External game ID from API (e.g., "776362")
  sport: text("sport").notNull(),
  // MLB, NFL, NBA, etc.
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  status: text("status").notNull(),
  // scheduled, live, final
  inning: integer("inning"),
  isTopInning: boolean("is_top_inning"),
  balls: integer("balls").default(0),
  strikes: integer("strikes").default(0),
  outs: integer("outs").default(0),
  // Base runners
  hasFirst: boolean("has_first").default(false),
  hasSecond: boolean("has_second").default(false),
  hasThird: boolean("has_third").default(false),
  // Enhanced player data
  currentBatter: text("current_batter"),
  currentPitcher: text("current_pitcher"),
  onDeckBatter: text("on_deck_batter"),
  // Weather context
  windSpeed: integer("wind_speed"),
  // mph
  windDirection: text("wind_direction"),
  // N, NE, E, SE, S, SW, W, NW
  temperature: integer("temperature"),
  // Fahrenheit
  humidity: integer("humidity"),
  // percentage
  // Enhanced data payload for flexibility
  enhancedData: jsonb("enhanced_data").$type(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertGameStateSchema = createInsertSchema(gameStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// db.ts
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// unified-diagnostics.ts
import { sql as sql2 } from "drizzle-orm";
import express from "express";
import { writeFileSync } from "fs";
var DiagnosticError = class extends Error {
  constructor(message, code, safeMessage) {
    super(message);
    this.code = code;
    this.safeMessage = safeMessage;
    this.name = "DiagnosticError";
  }
};
function getEnvironmentInfo() {
  return {
    NODE_ENV: process.env.NODE_ENV || "not set (defaults to development)",
    REPL_ID: process.env.REPL_ID ? "set" : "not set",
    DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
    PORT: process.env.PORT || "5000",
    SESSION_SECRET_EXISTS: !!process.env.SESSION_SECRET
  };
}
async function testDbConnection() {
  const result = {
    connected: false,
    userCount: 0,
    tableCount: 0,
    alertPreferences: 0,
    monitoredTeams: 0
  };
  try {
    const client = await pool.connect();
    result.connected = true;
    try {
      const dbInfo = await client.query("SELECT current_database(), version()");
      result.name = dbInfo.rows[0].current_database;
      result.version = `${dbInfo.rows[0].version.split(" ")[0]} ${dbInfo.rows[0].version.split(" ")[1]}`;
      const userCount = await client.query("SELECT COUNT(*) FROM users");
      result.userCount = parseInt(userCount.rows[0].count);
      const tableCount = await client.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
      );
      result.tableCount = parseInt(tableCount.rows[0].count);
      const alertPrefs = await client.query("SELECT COUNT(*) FROM user_alert_preferences");
      result.alertPreferences = parseInt(alertPrefs.rows[0].count);
      const monitoredTeams = await client.query("SELECT COUNT(*) FROM user_monitored_teams");
      result.monitoredTeams = parseInt(monitoredTeams.rows[0].count);
    } catch (queryError) {
      result.error = queryError.message;
    } finally {
      client.release();
    }
  } catch (connError) {
    result.error = connError.message;
  }
  return result;
}
async function getBasicDbStats() {
  const baseInfo = await testDbConnection();
  const result = {
    ...baseInfo,
    tables: [],
    users: []
  };
  if (!result.connected) {
    return result;
  }
  try {
    const client = await pool.connect();
    try {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      const tables = await client.query(tablesQuery);
      for (const table of tables.rows) {
        const tableName = table.table_name;
        try {
          const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
          result.tables.push({
            name: tableName,
            count: parseInt(count.rows[0].count)
          });
        } catch (err) {
          result.tables.push({
            name: tableName,
            count: 0,
            error: err.message
          });
        }
      }
      const users2 = await client.query(
        'SELECT id, username, email, role, "authMethod", "createdAt" FROM users ORDER BY "createdAt"'
      );
      result.users = users2.rows.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authMethod: user.authMethod,
        createdAt: user.createdAt
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    throw new DiagnosticError(
      `Failed to get database stats: ${error.message}`,
      "DB_STATS_ERROR",
      "Database statistics collection failed"
    );
  }
  return result;
}
async function runDeepAnalysis() {
  const results = {
    duplicates: [],
    orphans: [],
    mismatches: [],
    inconsistencies: [],
    summary: {
      users: 0,
      teams: 0,
      userMonitoredTeams: 0,
      userAlertPreferences: 0,
      globalAlertSettings: 0
    }
  };
  try {
    const userCount = await db.execute(sql2`SELECT COUNT(*) as count FROM users`);
    const teamCount = await db.execute(sql2`SELECT COUNT(*) as count FROM teams`);
    const monitoredCount = await db.execute(sql2`SELECT COUNT(*) as count FROM user_monitored_teams`);
    const prefsCount = await db.execute(sql2`SELECT COUNT(*) as count FROM user_alert_preferences`);
    const globalCount = await db.execute(sql2`SELECT COUNT(*) as count FROM global_alert_settings`);
    results.summary = {
      users: parseInt(userCount.rows[0]?.count || 0),
      teams: parseInt(teamCount.rows[0]?.count || 0),
      userMonitoredTeams: parseInt(monitoredCount.rows[0]?.count || 0),
      userAlertPreferences: parseInt(prefsCount.rows[0]?.count || 0),
      globalAlertSettings: parseInt(globalCount.rows[0]?.count || 0)
    };
    const duplicateUsers = await db.execute(sql2`
      SELECT username, email, COUNT(*) as count 
      FROM users 
      WHERE username IS NOT NULL OR email IS NOT NULL
      GROUP BY username, email 
      HAVING COUNT(*) > 1
    `);
    duplicateUsers.rows.forEach((row) => {
      results.duplicates.push({
        table: "users",
        type: "username/email",
        value: `${row.username || "NULL"} / ${row.email || "NULL"}`,
        count: row.count
      });
    });
    const duplicateTeams = await db.execute(sql2`
      SELECT name, sport, external_id, COUNT(*) as count 
      FROM teams 
      GROUP BY name, sport, external_id 
      HAVING COUNT(*) > 1
    `);
    duplicateTeams.rows.forEach((row) => {
      results.duplicates.push({
        table: "teams",
        type: "name/sport/external_id",
        value: `${row.name} (${row.sport}) [${row.external_id}]`,
        count: row.count
      });
    });
    const duplicateMonitored = await db.execute(sql2`
      SELECT user_id, game_id, sport, COUNT(*) as count 
      FROM user_monitored_teams 
      GROUP BY user_id, game_id, sport 
      HAVING COUNT(*) > 1
    `);
    duplicateMonitored.rows.forEach((row) => {
      results.duplicates.push({
        table: "user_monitored_teams",
        type: "user_id/game_id/sport",
        value: `User ${row.user_id} -> Game ${row.game_id} (${row.sport})`,
        count: row.count
      });
    });
    const duplicatePrefs = await db.execute(sql2`
      SELECT user_id, sport, alert_type, COUNT(*) as count 
      FROM user_alert_preferences 
      GROUP BY user_id, sport, alert_type 
      HAVING COUNT(*) > 1
    `);
    duplicatePrefs.rows.forEach((row) => {
      results.duplicates.push({
        table: "user_alert_preferences",
        type: "user_id/sport/alert_type",
        value: `User ${row.user_id} -> ${row.sport}.${row.alert_type}`,
        count: row.count
      });
    });
    const orphanedMonitored = await db.execute(sql2`
      SELECT umt.id, umt.user_id, umt.game_id 
      FROM user_monitored_teams umt
      LEFT JOIN users u ON umt.user_id = u.id
      WHERE u.id IS NULL
    `);
    orphanedMonitored.rows.forEach((row) => {
      results.orphans.push({
        table: "user_monitored_teams",
        type: "missing_user",
        id: row.id,
        details: `User ${row.user_id} -> Game ${row.game_id}`
      });
    });
    const orphanedPrefs = await db.execute(sql2`
      SELECT uap.id, uap.user_id, uap.sport, uap.alert_type 
      FROM user_alert_preferences uap
      LEFT JOIN users u ON uap.user_id = u.id
      WHERE u.id IS NULL
    `);
    orphanedPrefs.rows.forEach((row) => {
      results.orphans.push({
        table: "user_alert_preferences",
        type: "missing_user",
        id: row.id,
        details: `User ${row.user_id} -> ${row.sport}.${row.alert_type}`
      });
    });
    const invalidRoles = await db.execute(sql2`
      SELECT id, username, role 
      FROM users 
      WHERE role NOT IN ('admin', 'manager', 'analyst', 'user')
    `);
    invalidRoles.rows.forEach((row) => {
      results.inconsistencies.push({
        table: "users",
        type: "invalid_role",
        id: row.id,
        details: `${row.username}: "${row.role}"`
      });
    });
    const invalidSports = await db.execute(sql2`
      SELECT id, name, sport 
      FROM teams 
      WHERE sport NOT IN ('MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL')
    `);
    invalidSports.rows.forEach((row) => {
      results.inconsistencies.push({
        table: "teams",
        type: "invalid_sport",
        id: row.id,
        details: `${row.name}: "${row.sport}"`
      });
    });
    const invalidPrefSports = await db.execute(sql2`
      SELECT id, user_id, sport, alert_type 
      FROM user_alert_preferences 
      WHERE sport NOT IN ('mlb', 'nfl', 'nba', 'nhl', 'ncaaf', 'wnba', 'cfl')
    `);
    invalidPrefSports.rows.forEach((row) => {
      results.inconsistencies.push({
        table: "user_alert_preferences",
        type: "invalid_sport",
        id: row.id,
        details: `User ${row.user_id}: "${row.sport}.${row.alert_type}"`
      });
    });
    const userLoginConflicts = await db.execute(sql2`
      SELECT username, email, COUNT(*) as count, array_agg(id) as user_ids
      FROM users 
      WHERE username IS NOT NULL OR email IS NOT NULL
      GROUP BY username, email 
      HAVING COUNT(*) > 1
    `);
    userLoginConflicts.rows.forEach((row) => {
      results.mismatches.push({
        endpoint: "/api/auth/login",
        issue: "duplicate_credentials",
        details: `${row.username || "NULL"} / ${row.email || "NULL"}: IDs ${JSON.stringify(row.user_ids)}`
      });
    });
    const nullUsers = await db.execute(sql2`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE username IS NULL AND email IS NULL
    `);
    if (parseInt(nullUsers.rows[0]?.count || 0) > 0) {
      results.mismatches.push({
        endpoint: "/api/auth/*",
        issue: "null_credentials",
        details: `${nullUsers.rows[0].count} users with no username or email`
      });
    }
  } catch (error) {
    throw new DiagnosticError(
      `Deep analysis failed: ${error.message}`,
      "DEEP_ANALYSIS_ERROR",
      "Deep database analysis failed"
    );
  }
  return results;
}
function generateCleanupSQL(results) {
  const cleanupSQL = [];
  if (results.duplicates.length > 0) {
    cleanupSQL.push("-- DUPLICATE CLEANUP");
    cleanupSQL.push("-- WARNING: Review these queries carefully before executing");
    cleanupSQL.push("");
    results.duplicates.forEach((dup) => {
      if (dup.table === "user_alert_preferences") {
        cleanupSQL.push(`-- Remove duplicate alert preferences for ${dup.value}`);
        cleanupSQL.push(`DELETE FROM user_alert_preferences WHERE id NOT IN (`);
        cleanupSQL.push(`  SELECT MIN(id) FROM user_alert_preferences`);
        cleanupSQL.push(`  GROUP BY user_id, sport, alert_type`);
        cleanupSQL.push(`);`);
        cleanupSQL.push("");
      }
    });
  }
  if (results.orphans.length > 0) {
    cleanupSQL.push("-- ORPHANED RECORDS CLEANUP");
    cleanupSQL.push("-- WARNING: This will permanently delete orphaned data");
    cleanupSQL.push("");
    results.orphans.forEach((orphan) => {
      cleanupSQL.push(`-- Remove orphaned ${orphan.table} record: ${orphan.details}`);
      cleanupSQL.push(`DELETE FROM ${orphan.table} WHERE id = '${orphan.id}';`);
    });
  }
  if (cleanupSQL.length === 0) {
    cleanupSQL.push("-- No cleanup required - database is clean!");
  }
  return cleanupSQL.join("\n");
}
function sanitizeSecrets(obj) {
  const sanitized = { ...obj };
  if (typeof sanitized === "object" && sanitized !== null) {
    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === "object") {
        sanitized[key] = sanitizeSecrets(sanitized[key]);
      } else if (typeof sanitized[key] === "string") {
        if (key.toLowerCase().includes("database_url") || key.toLowerCase().includes("password") || key.toLowerCase().includes("secret")) {
          sanitized[key] = "[REDACTED]";
        }
      }
    });
  }
  return sanitized;
}
function toConsole(result, options = {}) {
  const lines = [];
  const { showTimestamp = true, showRecommendations = true, verboseOutput = false } = options;
  lines.push("\u{1F50D} Database and Environment Diagnostics");
  lines.push("=".repeat(50));
  if (showTimestamp) {
    lines.push(`\u23F0 Timestamp: ${result.timestamp}`);
    lines.push("");
  }
  lines.push("\u{1F4CA} ENVIRONMENT STATUS:");
  lines.push(`NODE_ENV: ${result.environment.NODE_ENV}`);
  lines.push(`REPL_ID: ${result.environment.REPL_ID}`);
  lines.push(`DATABASE_URL: ${result.environment.DATABASE_URL_EXISTS ? "set" : "not set"}`);
  lines.push(`PORT: ${result.environment.PORT}`);
  lines.push(`SESSION_SECRET: ${result.environment.SESSION_SECRET_EXISTS ? "set" : "not set"}`);
  if (result.analysis) {
    lines.push("");
    lines.push(`\u{1F3AF} LIKELY ENVIRONMENT: ${result.analysis.likelyEnvironment}`);
    const isReplit = result.environment.REPL_ID === "set";
    lines.push(`\u{1F3E2} Platform: ${isReplit ? "Replit" : "Unknown"}`);
  }
  lines.push("");
  lines.push("\u{1F50C} DATABASE CONNECTION:");
  if (result.database.connected) {
    lines.push("\u2705 Database connection successful");
    if (result.database.name && result.database.version) {
      lines.push(`\u{1F4CA} Database: ${result.database.name}`);
      lines.push(`\u{1F527} Version: ${result.database.version}`);
    }
  } else {
    lines.push("\u274C Database connection failed");
    if (result.database.error) {
      lines.push(`   Error: ${result.database.error}`);
    }
  }
  if (result.basicStats && result.database.connected) {
    lines.push("");
    lines.push("\u{1F4CB} DATABASE CONTENT ANALYSIS:");
    lines.push(`\u{1F4CA} Tables found: ${result.basicStats.tableCount}`);
    if (verboseOutput && result.basicStats.tables) {
      result.basicStats.tables.forEach((table) => {
        if (table.error) {
          lines.push(`  \u{1F4C4} ${table.name}: Error counting (${table.error})`);
        } else {
          lines.push(`  \u{1F4C4} ${table.name}: ${table.count} records`);
        }
      });
    }
    lines.push("");
    lines.push("\u{1F464} USER ANALYSIS:");
    lines.push(`Total users: ${result.basicStats.users.length}`);
    if (result.basicStats.users.length > 0) {
      if (verboseOutput) {
        lines.push("User details:");
        result.basicStats.users.forEach((user, index) => {
          const identifier = user.username || user.email || user.id;
          lines.push(`  ${index + 1}. ${identifier} (${user.role}) - ${user.authMethod} - Created: ${user.createdAt}`);
        });
      }
    } else {
      lines.push("\u26A0\uFE0F  NO USERS FOUND - This suggests empty production database");
    }
    lines.push("");
    lines.push("\u2699\uFE0F USER ALERT PREFERENCES:");
    lines.push(`Alert preferences: ${result.database.alertPreferences} records`);
    lines.push("");
    lines.push("\u{1F3AF} MONITORED TEAMS:");
    lines.push(`Monitored teams: ${result.database.monitoredTeams} records`);
  }
  if (result.deepAnalysis) {
    lines.push("");
    lines.push("\u{1F50D} DEEP ANALYSIS RESULTS:");
    lines.push("=".repeat(30));
    const { duplicates, orphans, inconsistencies, mismatches } = result.deepAnalysis;
    const totalIssues = duplicates.length + orphans.length + inconsistencies.length + mismatches.length;
    if (totalIssues === 0) {
      lines.push("\u2705 No issues found - database is healthy!");
    } else {
      lines.push(`Total Issues Found: ${totalIssues}`);
      lines.push(`- Duplicates: ${duplicates.length}`);
      lines.push(`- Orphaned Records: ${orphans.length}`);
      lines.push(`- Data Inconsistencies: ${inconsistencies.length}`);
      lines.push(`- Endpoint Mismatches: ${mismatches.length}`);
      if (verboseOutput) {
        if (duplicates.length > 0) {
          lines.push("");
          lines.push("\u274C DUPLICATES:");
          duplicates.forEach((dup) => {
            lines.push(`   - ${dup.table}: ${dup.value} (${dup.count} entries)`);
          });
        }
        if (orphans.length > 0) {
          lines.push("");
          lines.push("\u274C ORPHANED RECORDS:");
          orphans.forEach((orphan) => {
            lines.push(`   - ${orphan.table}: ${orphan.details}`);
          });
        }
        if (inconsistencies.length > 0) {
          lines.push("");
          lines.push("\u274C INCONSISTENCIES:");
          inconsistencies.forEach((inc) => {
            lines.push(`   - ${inc.table}: ${inc.details}`);
          });
        }
        if (mismatches.length > 0) {
          lines.push("");
          lines.push("\u274C ENDPOINT MISMATCHES:");
          mismatches.forEach((mis) => {
            lines.push(`   - ${mis.endpoint}: ${mis.details}`);
          });
        }
      }
    }
  }
  if (showRecommendations && result.analysis?.recommendations.length) {
    lines.push("");
    lines.push("\u{1F3AF} RECOMMENDATIONS:");
    result.analysis.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
  }
  return lines.join("\n");
}
function toJSON(result, options = {}) {
  const { sanitizeSecrets: shouldSanitize = true } = options;
  const output = shouldSanitize ? sanitizeSecrets(result) : result;
  return JSON.stringify(output, null, 2);
}
function generateAnalysis(env, db2, session, deepAnalysis) {
  const recommendations = [];
  const isProduction = env.NODE_ENV.includes("production");
  const hasUsers = db2.userCount > 0;
  const likelyEnvironment = isProduction ? "PRODUCTION" : "DEVELOPMENT";
  if (!db2.connected) {
    recommendations.push("Database connection failed - check DATABASE_URL");
  }
  if (db2.userCount === 0) {
    recommendations.push("No users found - likely empty production database");
    recommendations.push("Consider data migration from development to production");
  }
  if (session && !session.authenticated) {
    recommendations.push("User not authenticated - check session/login status");
  }
  if (db2.userCount > 0 && session && !session.authenticated) {
    recommendations.push("Users exist but session not working - check session configuration");
  }
  if (deepAnalysis) {
    const totalIssues = deepAnalysis.duplicates.length + deepAnalysis.orphans.length + deepAnalysis.inconsistencies.length + deepAnalysis.mismatches.length;
    if (totalIssues > 0) {
      recommendations.push(`Database integrity issues found: ${totalIssues} total`);
      recommendations.push("Run with --cleanup-sql flag to generate cleanup commands");
    }
  }
  return {
    likelyEnvironment,
    hasUserData: hasUsers,
    sessionWorking: session?.authenticated || false,
    issueDetected: !hasUsers || !db2.connected,
    recommendations
  };
}
async function runCLI(args) {
  try {
    const flags = {
      mode: "basic",
      json: false,
      cleanupSql: false,
      verbose: false,
      help: false
    };
    for (const arg of args) {
      if (arg.startsWith("--mode=")) {
        flags.mode = arg.split("=")[1];
      } else if (arg === "--json") {
        flags.json = true;
      } else if (arg === "--cleanup-sql") {
        flags.cleanupSql = true;
      } else if (arg === "--verbose") {
        flags.verbose = true;
      } else if (arg === "--help" || arg === "-h") {
        flags.help = true;
      }
    }
    if (flags.help) {
      console.log(`
\u{1F50D} Unified Database Diagnostics Tool

Usage: node unified-diagnostics.js [options]

Options:
  --mode=<type>     Diagnostic mode: basic, deep, env, all (default: basic)
  --json           Output as JSON instead of console format
  --cleanup-sql    Generate cleanup SQL file (requires deep mode)
  --verbose        Show detailed output
  --help, -h       Show this help message

Examples:
  node unified-diagnostics.js --mode=basic
  node unified-diagnostics.js --mode=deep --cleanup-sql
  node unified-diagnostics.js --mode=all --json
      `);
      return;
    }
    const options = {
      includeBasicStats: flags.mode === "basic" || flags.mode === "all",
      includeDeepAnalysis: flags.mode === "deep" || flags.mode === "all",
      includeSession: false,
      // Not available in CLI mode
      includeAnalysis: true
    };
    const result = await runUnifiedDiagnostics(options);
    if (flags.json) {
      console.log(toJSON(result, { sanitizeSecrets: true }));
    } else {
      console.log(toConsole(result, {
        verboseOutput: flags.verbose,
        showRecommendations: true,
        showTimestamp: true
      }));
    }
    if (flags.cleanupSql && result.deepAnalysis) {
      const cleanupSQL = generateCleanupSQL(result.deepAnalysis);
      writeFileSync("cleanup.sql", cleanupSQL);
      console.log("\n\u{1F4BE} Cleanup SQL saved to cleanup.sql");
    }
  } catch (error) {
    if (error instanceof DiagnosticError) {
      console.error(`\u274C ${error.safeMessage}`);
      process.exit(1);
    } else {
      console.error(`\u274C Unexpected error: ${error.message}`);
      process.exit(1);
    }
  }
}
function createDiagnosticsRouter() {
  const router = express.Router();
  router.get("/environment-status", async (req, res) => {
    try {
      const options = {
        includeBasicStats: true,
        includeDeepAnalysis: false,
        includeSession: true,
        includeAnalysis: true
      };
      const session = {
        authenticated: !!req.session?.userId,
        sessionId: req.sessionID ? "present" : "missing",
        user: req.session?.user || null
      };
      const result = await runUnifiedDiagnostics(options, session);
      res.json(sanitizeSecrets(result));
    } catch (error) {
      if (error instanceof DiagnosticError) {
        res.status(500).json({
          error: "Diagnostic failed",
          message: error.safeMessage,
          code: error.code,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        res.status(500).json({
          error: "Diagnostic failed",
          message: "Internal server error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  });
  router.get("/deep-analysis", async (req, res) => {
    try {
      const options = {
        includeBasicStats: false,
        includeDeepAnalysis: true,
        includeSession: false,
        includeAnalysis: false
      };
      const result = await runUnifiedDiagnostics(options);
      if (req.query.cleanup === "true" && result.deepAnalysis) {
        const cleanupSQL = generateCleanupSQL(result.deepAnalysis);
        res.json({
          ...sanitizeSecrets(result),
          cleanupSQL
        });
      } else {
        res.json(sanitizeSecrets(result));
      }
    } catch (error) {
      if (error instanceof DiagnosticError) {
        res.status(500).json({
          error: "Deep analysis failed",
          message: error.safeMessage,
          code: error.code,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        res.status(500).json({
          error: "Deep analysis failed",
          message: "Internal server error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  });
  return router;
}
async function runBasicDiagnostics() {
  const options = {
    includeBasicStats: true,
    includeDeepAnalysis: false,
    includeSession: false,
    includeAnalysis: true
  };
  return runUnifiedDiagnostics(options);
}
async function runDeepDiagnostics() {
  const result = await runDeepAnalysis();
  return result;
}
async function logEnvironmentStatus() {
  try {
    const result = await runBasicDiagnostics();
    console.log(toConsole(result, { verboseOutput: false, showRecommendations: false }));
  } catch (error) {
    if (error instanceof DiagnosticError) {
      console.error(`\u274C ${error.safeMessage}`);
    } else {
      console.error(`\u274C Environment status check failed: ${error.message}`);
    }
  }
}
async function runUnifiedDiagnostics(options = {}, session) {
  const {
    includeBasicStats = false,
    includeDeepAnalysis = false,
    includeSession = false,
    includeAnalysis = true
  } = options;
  const result = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: getEnvironmentInfo(),
    database: await testDbConnection()
  };
  if (includeSession && session) {
    result.session = session;
  }
  if (includeBasicStats && result.database.connected) {
    try {
      result.basicStats = await getBasicDbStats();
    } catch (error) {
      if (!(error instanceof DiagnosticError)) {
        throw error;
      }
    }
  }
  if (includeDeepAnalysis && result.database.connected) {
    try {
      result.deepAnalysis = await runDeepAnalysis();
    } catch (error) {
      if (!(error instanceof DiagnosticError)) {
        throw error;
      }
    }
  }
  if (includeAnalysis) {
    result.analysis = generateAnalysis(
      result.environment,
      result.database,
      result.session,
      result.deepAnalysis
    );
  }
  return result;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(process.argv.slice(2));
}
export {
  DiagnosticError,
  createDiagnosticsRouter,
  generateCleanupSQL,
  getBasicDbStats,
  getEnvironmentInfo,
  logEnvironmentStatus,
  runBasicDiagnostics,
  runCLI,
  runDeepAnalysis,
  runDeepDiagnostics,
  runUnifiedDiagnostics,
  testDbConnection,
  toConsole,
  toJSON
};
