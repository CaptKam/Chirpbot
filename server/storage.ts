import { type User, type InsertUser, type Team, type InsertTeam, type Alert, type InsertAlert, type Settings, type InsertSettings, type UserMonitoredTeam, type InsertUserMonitoredTeam, type AiSettings, type InsertAiSettings, type AiLearningLog, type InsertAiLearningLog, type AuditLog, type InsertAuditLog, type GlobalAlertControl, type InsertGlobalAlertControl, users, userMonitoredTeams, teams, alerts, settings, aiSettings, aiLearningLogs, auditLogs, globalAlertControls } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByOAuthId(provider: 'google' | 'apple', oauthId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Teams
  getAllTeams(): Promise<Team[]>;
  getTeamsBySport(sport: string): Promise<Team[]>;
  getMonitoredTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined>;
  toggleTeamMonitoring(id: string, monitored: boolean): Promise<Team | undefined>;

  // User Monitored Games (Persistent Team Selection)
  getUserMonitoredGames(userId: string): Promise<UserMonitoredTeam[]>;
  getUserMonitoredGamesBySport(userId: string, sport: string): Promise<UserMonitoredTeam[]>;
  getAllMonitoredGames(): Promise<UserMonitoredTeam[]>;
  addUserMonitoredGame(monitoring: InsertUserMonitoredTeam): Promise<UserMonitoredTeam>;
  removeUserMonitoredGame(userId: string, gameId: string): Promise<void>;
  clearAllUserMonitoredGames(userId: string): Promise<void>;
  isGameMonitoredByUser(userId: string, gameId: string): Promise<boolean>;

  // Alerts
  getAllAlerts(): Promise<Alert[]>;
  getAlertsBySport(sport: string): Promise<Alert[]>;
  getAlertsByType(type: string): Promise<Alert[]>;
  getRecentAlerts(limit?: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertSentToTelegram(id: string): Promise<void>;
  markAlertAsSeen(id: string): Promise<void>;
  markAllAlertsAsSeen(): Promise<void>;
  getUnseenAlertsCount(): Promise<number>;
  deleteAlert(id: string): Promise<void>;
  clearAllUserAlerts(userId: string): Promise<void>;

  // Settings
  getSettingsBySport(sport: string): Promise<Settings | undefined>;
  getAllSettings(): Promise<Settings[]>;
  createSettings(settings: InsertSettings): Promise<Settings>;
  updateSettings(sport: string, updates: Partial<Settings>): Promise<Settings | undefined>;

  // Admin AI Settings
  getAiSettingsBySport(sport: string): Promise<AiSettings | undefined>;
  getAllAiSettings(): Promise<AiSettings[]>;
  createAiSettings(settings: InsertAiSettings): Promise<AiSettings>;
  updateAiSettings(sport: string, updates: Partial<AiSettings>): Promise<AiSettings | undefined>;

  // AI Learning Logs
  getAllAiLearningLogs(): Promise<AiLearningLog[]>;
  getAiLearningLogsBySport(sport: string): Promise<AiLearningLog[]>;
  getAiLearningLogsByType(sport: string, alertType: string): Promise<AiLearningLog[]>;
  createAiLearningLog(log: InsertAiLearningLog): Promise<AiLearningLog>;
  updateAiLearningLogFeedback(id: string, feedback: number, feedbackText?: string): Promise<AiLearningLog | undefined>;
  getRecentAiLearningLogs(limit?: number): Promise<AiLearningLog[]>;

  // Audit Logs
  getAllAuditLogs(): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string): Promise<AuditLog[]>;
  getAuditLogsByResource(resource: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getRecentAuditLogs(limit?: number): Promise<AuditLog[]>;

  // Global Alert Controls - Master Admin Control System
  getAllGlobalAlertControls(): Promise<GlobalAlertControl[]>;
  getGlobalAlertControlsBySport(sport: string): Promise<GlobalAlertControl[]>;
  getGlobalAlertControl(sport: string, alertType: string): Promise<GlobalAlertControl | undefined>;
  createGlobalAlertControl(control: InsertGlobalAlertControl): Promise<GlobalAlertControl>;
  updateGlobalAlertControl(id: string, updates: Partial<GlobalAlertControl>): Promise<GlobalAlertControl | undefined>;
  toggleGlobalAlertControl(id: string, enabled: boolean): Promise<GlobalAlertControl | undefined>;
  initializeGlobalAlertControls(): Promise<void>;
  getEnabledAlertTypes(sport?: string): Promise<string[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private teams: Map<string, Team>;
  private alerts: Map<string, Alert>;
  private settings: Map<string, Settings>;

  constructor() {
    this.users = new Map();
    this.teams = new Map();
    this.alerts = new Map();
    this.settings = new Map();

    // Initialize with default teams and settings
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Default MLB teams
    const mlbTeams = [
      { name: "Los Angeles Dodgers", initials: "LAD", sport: "MLB", logoColor: "#005A9C" },
      { name: "San Francisco Giants", initials: "SF", sport: "MLB", logoColor: "#FD5A1E" },
      { name: "San Diego Padres", initials: "SD", sport: "MLB", logoColor: "#FFC425" },
      { name: "Arizona Diamondbacks", initials: "AZ", sport: "MLB", logoColor: "#A71930" },
    ];

    // Default NFL teams
    const nflTeams = [
      { name: "Kansas City Chiefs", initials: "KC", sport: "NFL", logoColor: "#E31837" },
      { name: "Buffalo Bills", initials: "BUF", sport: "NFL", logoColor: "#00338D" },
    ];

    // Default NBA teams
    const nbaTeams = [
      { name: "Los Angeles Lakers", initials: "LAL", sport: "NBA", logoColor: "#552583" },
      { name: "Boston Celtics", initials: "BOS", sport: "NBA", logoColor: "#007A33" },
    ];

    [...mlbTeams, ...nflTeams, ...nbaTeams].forEach(team => {
      const id = randomUUID();
      this.teams.set(id, { 
        ...team, 
        id, 
        monitored: team.initials === "LAD", // Monitor Dodgers by default
        externalId: null 
      });
    });

    // Default settings for each sport
    const sports = ["MLB", "NFL", "NBA", "NHL"];
    sports.forEach(sport => {
      const id = randomUUID();
      this.settings.set(sport, {
        id,
        sport,
        alertTypes: {
          // MLB Alert Types
          risp: sport === "MLB",
          homeRun: sport === "MLB",
          lateInning: sport === "MLB",
          closeGame: sport === "MLB",
          runnersOnBase: sport === "MLB",
          hits: sport === "MLB",
          scoring: sport === "MLB",
          inningChange: false,
          homeRunAlert: sport === "MLB",
          strikeouts: false,
          
          // RE24 System
          useRE24System: sport === "MLB",
          re24Level1: sport === "MLB",
          re24Level2: sport === "MLB",
          re24Level3: sport === "MLB",

          // NFL Alert Types  
          redZone: sport === "NFL",
          nflCloseGame: sport === "NFL",
          fourthDown: sport === "NFL",
          twoMinuteWarning: sport === "NFL",

          // NBA Alert Types
          clutchTime: sport === "NBA",
          nbaCloseGame: sport === "NBA",
          overtime: sport === "NBA",

          // NHL Alert Types
          powerPlay: sport === "NHL",
          nhlCloseGame: sport === "NHL",
          emptyNet: sport === "NHL",
        },
        telegramEnabled: true,
        pushNotificationsEnabled: true,
      });
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Case-insensitive search for username or email
    const lowerInput = username.toLowerCase();
    return Array.from(this.users.values()).find(user => 
      (user.username && user.username.toLowerCase() === lowerInput) ||
      (user.email && user.email.toLowerCase() === lowerInput)
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const lowerEmail = email.toLowerCase();
    return Array.from(this.users.values()).find(user => 
      user.email && user.email.toLowerCase() === lowerEmail
    );
  }

  async getUserByOAuthId(provider: 'google' | 'apple', oauthId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => {
      if (provider === 'google') {
        return user.googleId === oauthId;
      } else if (provider === 'apple') {
        return user.appleId === oauthId;
      }
      return false;
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      username: insertUser.username || null,
      email: insertUser.email || null,
      password: insertUser.password || null,
      googleId: insertUser.googleId || null,
      appleId: insertUser.appleId || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImage: insertUser.profileImage || null,
      authMethod: insertUser.authMethod || 'local',
      emailVerified: insertUser.email ? false : false, // Will be true after email verification
      role: 'user', // Default role for new users
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  // Team methods
  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  async getTeamsBySport(sport: string): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(team => team.sport === sport);
  }

  async getMonitoredTeams(): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(team => team.monitored);
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const id = randomUUID();
    const team: Team = { ...insertTeam, id, logoColor: insertTeam.logoColor || "#1D2E5F", monitored: insertTeam.monitored || false, externalId: insertTeam.externalId || null };
    this.teams.set(id, team);
    return team;
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const team = this.teams.get(id);
    if (!team) return undefined;

    const updatedTeam = { ...team, ...updates };
    this.teams.set(id, updatedTeam);
    return updatedTeam;
  }

  async toggleTeamMonitoring(id: string, monitored: boolean): Promise<Team | undefined> {
    return this.updateTeam(id, { monitored });
  }

  // User Monitored Games methods (Mock implementation for MemStorage)
  async getUserMonitoredGames(userId: string): Promise<UserMonitoredTeam[]> {
    return []; // Mock implementation
  }

  async getUserMonitoredGamesBySport(userId: string, sport: string): Promise<UserMonitoredTeam[]> {
    return []; // Mock implementation  
  }
  
  async getAllMonitoredGames(): Promise<UserMonitoredTeam[]> {
    return []; // Mock implementation - no monitored games in memory storage
  }

  async addUserMonitoredGame(monitoring: InsertUserMonitoredTeam): Promise<UserMonitoredTeam> {
    // Mock implementation
    return {
      id: randomUUID(),
      ...monitoring,
      createdAt: new Date()
    };
  }

  async removeUserMonitoredGame(userId: string, gameId: string): Promise<void> {
    // Mock implementation - do nothing
  }

  async clearAllUserMonitoredGames(userId: string): Promise<void> {
    // Mock implementation - do nothing
  }

  async isGameMonitoredByUser(userId: string, gameId: string): Promise<boolean> {
    return false; // Mock implementation
  }

  // Alert methods
  async getAllAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAlertsBySport(sport: string): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => alert.sport === sport)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAlertsByType(type: string): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => alert.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRecentAlerts(limit = 30): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const alert: Alert = { 
      ...insertAlert, 
      id, 
      timestamp: new Date(),
      sentToTelegram: false,
      seen: false,
      gameInfo: {
        ...insertAlert.gameInfo,
        quarter: insertAlert.gameInfo.quarter as string | undefined,
        inning: insertAlert.gameInfo.inning as string | undefined,
        period: insertAlert.gameInfo.period as string | undefined,
        inningState: insertAlert.gameInfo.inningState as "top" | "bottom" | undefined,
        outs: insertAlert.gameInfo.outs as number | undefined,
        balls: insertAlert.gameInfo.balls as number | undefined,
        strikes: insertAlert.gameInfo.strikes as number | undefined,
        runners: insertAlert.gameInfo.runners as { first: boolean; second: boolean; third: boolean; } | undefined,
        score: insertAlert.gameInfo.score as { home: number; away: number; } | undefined,
        priority: insertAlert.gameInfo.priority as number | undefined,
        scoringProbability: insertAlert.gameInfo.scoringProbability as number | undefined,
        currentPitcher: insertAlert.gameInfo.currentPitcher as { id: number; name: string; throwHand: string; stats: { era: number; whip: number; strikeOuts: number; wins: number; losses: number; }; } | undefined,
        currentBatter: insertAlert.gameInfo.currentBatter as { id: number; name: string; batSide: string; stats: { avg: number; hr: number; rbi: number; obp: number; ops: number; }; } | undefined,
      },
      weatherData: insertAlert.weatherData ? {
        temperature: insertAlert.weatherData.temperature,
        condition: insertAlert.weatherData.condition,
        windSpeed: insertAlert.weatherData.windSpeed as number | undefined,
        windDirection: insertAlert.weatherData.windDirection as string | undefined
      } : null
    };
    this.alerts.set(id, alert);

    // Auto-clear old alerts if we have more than 30
    if (this.alerts.size > 30) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());

      // Keep only the 30 most recent alerts
      const alertsToDelete = sortedAlerts.slice(30);
      alertsToDelete.forEach(([alertId]) => {
        this.alerts.delete(alertId);
      });
    }

    return alert;
  }

  async markAlertSentToTelegram(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.sentToTelegram = true;
      this.alerts.set(id, alert);
    }
  }

  async markAlertAsSeen(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.seen = true;
      this.alerts.set(id, alert);
    }
  }

  async markAllAlertsAsSeen(): Promise<void> {
    Array.from(this.alerts.values()).forEach(alert => {
      alert.seen = true;
      this.alerts.set(alert.id, alert);
    });
  }

  async getUnseenAlertsCount(): Promise<number> {
    return Array.from(this.alerts.values()).filter(alert => !alert.seen).length;
  }

  async deleteAlert(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  async clearAllUserAlerts(userId: string): Promise<void> {
    // For MemStorage, we'll clear all alerts since we don't track user ownership
    this.alerts.clear();
  }

  // Settings methods
  async getSettingsBySport(sport: string): Promise<Settings | undefined> {
    return this.settings.get(sport);
  }

  async getAllSettings(): Promise<Settings[]> {
    return Array.from(this.settings.values());
  }

  async createSettings(insertSettings: InsertSettings): Promise<Settings> {
    const id = randomUUID();
    const settings: Settings = { 
      ...insertSettings, 
      id,
      alertTypes: insertSettings.alertTypes || { risp: false, homeRun: false, lateInning: false, redZone: false, clutchTime: false },
      telegramEnabled: insertSettings.telegramEnabled ?? true,
      pushNotificationsEnabled: insertSettings.pushNotificationsEnabled ?? true
    };
    this.settings.set(settings.sport, settings);
    return settings;
  }

  async updateSettings(sport: string, updates: Partial<Settings>): Promise<Settings | undefined> {
    const settings = this.settings.get(sport);
    if (!settings) return undefined;

    const updatedSettings = { ...settings, ...updates };
    this.settings.set(sport, updatedSettings);
    return updatedSettings;
  }

  // Admin AI Settings methods (Mock implementations for MemStorage)
  async getAiSettingsBySport(sport: string): Promise<AiSettings | undefined> {
    // Mock implementation - return default settings
    return {
      id: randomUUID(),
      sport,
      enabled: false,
      dryRun: true,
      rateLimitMs: 30000,
      minProbability: 65,
      inningThreshold: 6,
      allowTypes: [],
      redactPii: true,
      model: "gpt-4o-mini",
      maxTokens: 500,
      temperature: 70,
      updatedBy: null,
      updatedAt: new Date(),
    };
  }

  async getAllAiSettings(): Promise<AiSettings[]> {
    return []; // Mock implementation
  }

  async createAiSettings(settings: InsertAiSettings): Promise<AiSettings> {
    const aiSettings: AiSettings = {
      id: randomUUID(),
      ...settings,
      updatedAt: new Date(),
    };
    return aiSettings;
  }

  async updateAiSettings(sport: string, updates: Partial<AiSettings>): Promise<AiSettings | undefined> {
    // Mock implementation - just return updated settings
    return {
      id: randomUUID(),
      sport,
      enabled: false,
      dryRun: true,
      rateLimitMs: 30000,
      minProbability: 65,
      inningThreshold: 6,
      allowTypes: [],
      redactPii: true,
      model: "gpt-4o-mini",
      maxTokens: 500,
      temperature: 70,
      updatedBy: null,
      updatedAt: new Date(),
      ...updates,
    };
  }

  // AI Learning Logs methods (Mock implementations for MemStorage)
  async getAllAiLearningLogs(): Promise<AiLearningLog[]> {
    return []; // Mock implementation
  }

  async getAiLearningLogsBySport(sport: string): Promise<AiLearningLog[]> {
    return []; // Mock implementation
  }

  async getAiLearningLogsByType(sport: string, alertType: string): Promise<AiLearningLog[]> {
    return []; // Mock implementation
  }

  async createAiLearningLog(log: InsertAiLearningLog): Promise<AiLearningLog> {
    const aiLog: AiLearningLog = {
      id: randomUUID(),
      ...log,
      createdAt: new Date(),
    };
    return aiLog;
  }

  async updateAiLearningLogFeedback(id: string, feedback: number, feedbackText?: string): Promise<AiLearningLog | undefined> {
    // Mock implementation
    return {
      id,
      sport: "MLB",
      alertType: "test",
      gameId: null,
      inputData: { originalAlert: { type: "test", title: "test", description: "test", confidence: 50 }, gameInfo: {} },
      aiResponse: null,
      success: false,
      errorMessage: null,
      confidence: null,
      userFeedback: feedback,
      userFeedbackText: feedbackText || null,
      settings: { model: "gpt-4o-mini", temperature: 70, maxTokens: 500, redactPii: true },
      createdAt: new Date(),
    };
  }

  async getRecentAiLearningLogs(limit = 50): Promise<AiLearningLog[]> {
    return []; // Mock implementation
  }

  // Audit Logs methods (Mock implementations for MemStorage)
  async getAllAuditLogs(): Promise<AuditLog[]> {
    return []; // Mock implementation
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return []; // Mock implementation
  }

  async getAuditLogsByResource(resource: string): Promise<AuditLog[]> {
    return []; // Mock implementation
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: randomUUID(),
      ...log,
      createdAt: new Date(),
    };
    return auditLog;
  }

  async getRecentAuditLogs(limit = 50): Promise<AuditLog[]> {
    return []; // Mock implementation
  }

  // Global Alert Controls - MemStorage implementation (stub)
  async getAllGlobalAlertControls(): Promise<GlobalAlertControl[]> { return []; }
  async getGlobalAlertControlsBySport(sport: string): Promise<GlobalAlertControl[]> { return []; }
  async getGlobalAlertControl(sport: string, alertType: string): Promise<GlobalAlertControl | undefined> { return undefined; }
  async createGlobalAlertControl(control: InsertGlobalAlertControl): Promise<GlobalAlertControl> { 
    const id = randomUUID();
    return {
      id,
      ...control,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async updateGlobalAlertControl(id: string, updates: Partial<GlobalAlertControl>): Promise<GlobalAlertControl | undefined> { return undefined; }
  async toggleGlobalAlertControl(id: string, enabled: boolean): Promise<GlobalAlertControl | undefined> { return undefined; }
  async initializeGlobalAlertControls(): Promise<void> { }
  async getEnabledAlertTypes(sport?: string): Promise<string[]> { return []; }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Case-insensitive search for username or email
    const lowerInput = username.toLowerCase();
    const [user] = await db.select().from(users)
      .where(sql`(LOWER(${users.username}) = ${lowerInput} OR LOWER(${users.email}) = ${lowerInput})`);
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const lowerEmail = email.toLowerCase();
    const [user] = await db.select().from(users)
      .where(sql`LOWER(${users.email}) = ${lowerEmail}`);
    return user || undefined;
  }

  async getUserByOAuthId(provider: 'google' | 'apple', oauthId: string): Promise<User | undefined> {
    const column = provider === 'google' ? users.googleId : users.appleId;
    const [user] = await db.select().from(users).where(eq(column, oauthId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Team methods (legacy, but maintained for compatibility)
  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeamsBySport(sport: string): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.sport, sport));
  }

  async getMonitoredTeams(): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.monitored, true));
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const [team] = await db.insert(teams).values(insertTeam).returning();
    return team;
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const [updatedTeam] = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return updatedTeam || undefined;
  }

  async toggleTeamMonitoring(id: string, monitored: boolean): Promise<Team | undefined> {
    return this.updateTeam(id, { monitored });
  }

  // User Monitored Games methods (NEW - for persistent game selection)
  async getUserMonitoredGames(userId: string): Promise<UserMonitoredTeam[]> {
    return await db.select().from(userMonitoredTeams).where(eq(userMonitoredTeams.userId, userId));
  }

  async getUserMonitoredGamesBySport(userId: string, sport: string): Promise<UserMonitoredTeam[]> {
    return await db.select().from(userMonitoredTeams)
      .where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.sport, sport)));
  }

  async addUserMonitoredGame(monitoring: InsertUserMonitoredTeam): Promise<UserMonitoredTeam> {
    const [monitoredGame] = await db.insert(userMonitoredTeams).values(monitoring).returning();
    return monitoredGame;
  }

  async removeUserMonitoredGame(userId: string, gameId: string): Promise<void> {
    await db.delete(userMonitoredTeams)
      .where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.gameId, gameId)));
  }

  async clearAllUserMonitoredGames(userId: string): Promise<void> {
    await db.delete(userMonitoredTeams)
      .where(eq(userMonitoredTeams.userId, userId));
  }

  async isGameMonitoredByUser(userId: string, gameId: string): Promise<boolean> {
    const [result] = await db.select().from(userMonitoredTeams)
      .where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.gameId, gameId)));
    return !!result;
  }
  
  async getAllMonitoredGames(): Promise<UserMonitoredTeam[]> {
    return await db.select().from(userMonitoredTeams);
  }

  // Alert methods
  async getAllAlerts(): Promise<Alert[]> {
    return await db.select().from(alerts);
  }

  async getAlertsBySport(sport: string): Promise<Alert[]> {
    return await db.select().from(alerts).where(eq(alerts.sport, sport));
  }

  async getAlertsByType(type: string): Promise<Alert[]> {
    return await db.select().from(alerts).where(eq(alerts.type, type));
  }

  async getRecentAlerts(limit = 50): Promise<Alert[]> {
    return await db.select().from(alerts).orderBy(desc(alerts.timestamp)).limit(limit);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const alertToInsert = {
      ...insertAlert,
      gameInfo: {
        ...insertAlert.gameInfo,
        quarter: insertAlert.gameInfo.quarter as string | undefined,
        inning: insertAlert.gameInfo.inning as string | undefined,
        period: insertAlert.gameInfo.period as string | undefined,
        inningState: insertAlert.gameInfo.inningState as "top" | "bottom" | undefined,
        outs: insertAlert.gameInfo.outs as number | undefined,
        balls: insertAlert.gameInfo.balls as number | undefined,
        strikes: insertAlert.gameInfo.strikes as number | undefined,
        runners: insertAlert.gameInfo.runners as { first: boolean; second: boolean; third: boolean; } | undefined,
        score: insertAlert.gameInfo.score as { home: number; away: number; } | undefined,
        priority: insertAlert.gameInfo.priority as number | undefined,
        scoringProbability: insertAlert.gameInfo.scoringProbability as number | undefined,
        currentPitcher: insertAlert.gameInfo.currentPitcher as { id: number; name: string; throwHand: string; stats: { era: number; whip: number; strikeOuts: number; wins: number; losses: number; }; } | undefined,
        currentBatter: insertAlert.gameInfo.currentBatter as { id: number; name: string; batSide: string; stats: { avg: number; hr: number; rbi: number; obp: number; ops: number; }; } | undefined,
      },
      weatherData: insertAlert.weatherData ? {
        temperature: insertAlert.weatherData.temperature,
        condition: insertAlert.weatherData.condition,
        windSpeed: insertAlert.weatherData.windSpeed as number | undefined,
        windDirection: insertAlert.weatherData.windDirection as string | undefined,
      } : null,
    };
    const [alert] = await db.insert(alerts).values([alertToInsert]).returning();
    return alert;
  }

  async markAlertSentToTelegram(id: string): Promise<void> {
    await db.update(alerts).set({ sentToTelegram: true }).where(eq(alerts.id, id));
  }

  async markAlertAsSeen(id: string): Promise<void> {
    await db.update(alerts).set({ seen: true }).where(eq(alerts.id, id));
  }

  async markAllAlertsAsSeen(): Promise<void> {
    await db.update(alerts).set({ seen: true });
  }

  async getUnseenAlertsCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(alerts).where(eq(alerts.seen, false));
    return Number(result[0]?.count || 0);
  }

  async deleteAlert(id: string): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }

  async clearAllUserAlerts(userId: string): Promise<void> {
    // Clear all alerts since they're global in the current system
    await db.delete(alerts);
  }

  // Settings methods
  async getSettingsBySport(sport: string): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.sport, sport));
    return setting || undefined;
  }

  async getAllSettings(): Promise<Settings[]> {
    return await db.select().from(settings);
  }

  async createSettings(insertSettings: InsertSettings): Promise<Settings> {
    const [setting] = await db.insert(settings).values(insertSettings).returning();
    return setting;
  }

  async updateSettings(sport: string, updates: Partial<Settings>): Promise<Settings | undefined> {
    const [updatedSettings] = await db.update(settings).set(updates).where(eq(settings.sport, sport)).returning();
    return updatedSettings || undefined;
  }

  // Admin AI Settings methods
  async getAiSettingsBySport(sport: string): Promise<AiSettings | undefined> {
    const [aiSetting] = await db.select().from(aiSettings).where(eq(aiSettings.sport, sport));
    return aiSetting || undefined;
  }

  async getAllAiSettings(): Promise<AiSettings[]> {
    return await db.select().from(aiSettings);
  }

  async createAiSettings(settings: InsertAiSettings): Promise<AiSettings> {
    const [aiSetting] = await db.insert(aiSettings).values(settings).returning();
    return aiSetting;
  }

  async updateAiSettings(sport: string, updates: Partial<AiSettings>): Promise<AiSettings | undefined> {
    const [updatedAiSettings] = await db.update(aiSettings).set(updates).where(eq(aiSettings.sport, sport)).returning();
    return updatedAiSettings || undefined;
  }

  // AI Learning Logs methods
  async getAllAiLearningLogs(): Promise<AiLearningLog[]> {
    return await db.select().from(aiLearningLogs).orderBy(desc(aiLearningLogs.createdAt));
  }

  async getAiLearningLogsBySport(sport: string): Promise<AiLearningLog[]> {
    return await db.select().from(aiLearningLogs)
      .where(eq(aiLearningLogs.sport, sport))
      .orderBy(desc(aiLearningLogs.createdAt));
  }

  async getAiLearningLogsByType(sport: string, alertType: string): Promise<AiLearningLog[]> {
    return await db.select().from(aiLearningLogs)
      .where(and(eq(aiLearningLogs.sport, sport), eq(aiLearningLogs.alertType, alertType)))
      .orderBy(desc(aiLearningLogs.createdAt));
  }

  async createAiLearningLog(log: InsertAiLearningLog): Promise<AiLearningLog> {
    const [aiLog] = await db.insert(aiLearningLogs).values(log).returning();
    return aiLog;
  }

  async updateAiLearningLogFeedback(id: string, feedback: number, feedbackText?: string): Promise<AiLearningLog | undefined> {
    const [updatedLog] = await db.update(aiLearningLogs)
      .set({ userFeedback: feedback, userFeedbackText: feedbackText })
      .where(eq(aiLearningLogs.id, id))
      .returning();
    return updatedLog || undefined;
  }

  async getRecentAiLearningLogs(limit = 50): Promise<AiLearningLog[]> {
    return await db.select().from(aiLearningLogs)
      .orderBy(desc(aiLearningLogs.createdAt))
      .limit(limit);
  }

  // Audit Logs methods
  async getAllAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getAuditLogsByResource(resource: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.resource, resource))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(log).returning();
    return auditLog;
  }

  async getRecentAuditLogs(limit = 50): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  // Global Alert Controls - DatabaseStorage implementation
  async getAllGlobalAlertControls(): Promise<GlobalAlertControl[]> {
    return await db.select().from(globalAlertControls);
  }

  async getGlobalAlertControlsBySport(sport: string): Promise<GlobalAlertControl[]> {
    return await db.select().from(globalAlertControls).where(eq(globalAlertControls.sport, sport));
  }

  async getGlobalAlertControl(sport: string, alertType: string): Promise<GlobalAlertControl | undefined> {
    const [control] = await db.select().from(globalAlertControls)
      .where(and(eq(globalAlertControls.sport, sport), eq(globalAlertControls.alertType, alertType)));
    return control || undefined;
  }

  async createGlobalAlertControl(control: InsertGlobalAlertControl): Promise<GlobalAlertControl> {
    const [created] = await db.insert(globalAlertControls).values(control).returning();
    return created;
  }

  async updateGlobalAlertControl(id: string, updates: Partial<GlobalAlertControl>): Promise<GlobalAlertControl | undefined> {
    const [updated] = await db.update(globalAlertControls)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(globalAlertControls.id, id))
      .returning();
    return updated || undefined;
  }

  async toggleGlobalAlertControl(id: string, enabled: boolean): Promise<GlobalAlertControl | undefined> {
    return this.updateGlobalAlertControl(id, { enabled });
  }

  async initializeGlobalAlertControls(): Promise<void> {
    console.log("🔧 Initializing Global Alert Controls system...");
    
    // Check if already initialized
    const existing = await db.select().from(globalAlertControls).limit(1);
    if (existing.length > 0) {
      console.log("📋 Global Alert Controls already initialized, skipping...");
      return;
    }

    // Define all alert types from the engines
    const alertControlsData = [
      // MLB Engine Alerts - Game Situations (3 types)
      { sport: "MLB", alertType: "Game Start", settingKey: "inningChange", enabled: true, priority: 40, probability: 100, description: "⚾ GAME START - First pitch!", category: "game_situations" },
      { sport: "MLB", alertType: "7th Inning Warning", settingKey: "lateInning", enabled: true, priority: 50, probability: 100, description: "🚨 7TH INNING STRETCH - Critical innings ahead!", category: "game_situations" },
      { sport: "MLB", alertType: "Tie Game 9th Inning", settingKey: "closeGame", enabled: true, priority: 85, probability: 100, description: "🔥 TIE GAME 9TH INNING - FINAL INNING DRAMA!", category: "game_situations" },
      
      // MLB Engine Alerts - Runners in Scoring Position (5 types)
      { sport: "MLB", alertType: "Bases Loaded 0 Outs", settingKey: "risp", enabled: true, priority: 95, probability: 100, description: "🚨 BASES LOADED, 0 OUTS! - MAXIMUM scoring opportunity!", category: "runners_risp" },
      { sport: "MLB", alertType: "Bases Loaded 1 Out", settingKey: "risp", enabled: true, priority: 85, probability: 100, description: "🔥 BASES LOADED, 1 OUT! - High-value scoring chance!", category: "runners_risp" },
      { sport: "MLB", alertType: "Bases Loaded 2 Outs", settingKey: "risp", enabled: true, priority: 95, probability: 100, description: "🚨 BASES LOADED, 2 OUTS! - MAXIMUM PRESSURE! Make or break moment!", category: "runners_risp" },
      { sport: "MLB", alertType: "Runner on 3rd, 1 Out", settingKey: "risp", enabled: true, priority: 80, probability: 85, description: "🎯 RUNNER ON 3RD, 1 OUT! (55% scoring probability)", category: "runners_risp" },
      { sport: "MLB", alertType: "Runners on 2nd & 3rd, 1 Out", settingKey: "risp", enabled: true, priority: 85, probability: 90, description: "🎯 RUNNERS ON 2ND & 3RD, 1 OUT! High scoring potential!", category: "runners_risp" },
      
      // MLB Engine Alerts - Batter-Specific (1 type)
      { sport: "MLB", alertType: "300+ Hitter Alert", settingKey: "avgHitter", enabled: true, priority: 75, probability: 100, description: "🎯 .300+ HITTER! Premium contact hitter at bat!", category: "batter_specific" },
      // MLB Engine Alerts - AI Predictions (6 types)
      { sport: "MLB", alertType: "Hot Streak Prediction", settingKey: null, enabled: true, priority: 80, probability: 100, description: "🔥 HOT STREAK PREDICTION - Batter on fire!", category: "ai_predictions" },
      { sport: "MLB", alertType: "Clutch Hit Prediction", settingKey: null, enabled: true, priority: 90, probability: 100, description: "⚡ CLUTCH HIT POTENTIAL - High-pressure moment!", category: "ai_predictions" },
      { sport: "MLB", alertType: "Stolen Base Prediction", settingKey: null, enabled: true, priority: 70, probability: 100, description: "💨 STOLEN BASE OPPORTUNITY - Speed on display!", category: "ai_predictions" },
      { sport: "MLB", alertType: "Home Run Prediction", settingKey: null, enabled: true, priority: 95, probability: 100, description: "💥 HOME RUN POTENTIAL - Long ball opportunity!", category: "ai_predictions" },
      { sport: "MLB", alertType: "Double Play Prediction", settingKey: null, enabled: true, priority: 75, probability: 100, description: "⚡ DOUBLE PLAY POTENTIAL - Defensive momentum!", category: "ai_predictions" },
      { sport: "MLB", alertType: "Walk-off Prediction", settingKey: null, enabled: true, priority: 100, probability: 100, description: "🚨 WALK-OFF POTENTIAL - Game winner opportunity!", category: "ai_predictions" },
      
      // MLB Engine Alerts - Weather Related (2 types)
      { sport: "MLB", alertType: "Weather Home Run Boost", settingKey: null, enabled: true, priority: 85, probability: 100, description: "🌬️ WEATHER BOOST - Wind helping home runs!", category: "weather_conditions" },
      { sport: "MLB", alertType: "Weather Pitching Advantage", settingKey: null, enabled: true, priority: 75, probability: 100, description: "🌧️ PITCHING CONDITIONS - Weather favors pitchers!", category: "weather_conditions" },
      
      // MLB Engine Alerts - Special Game Situations (7 types)
      { sport: "MLB", alertType: "Infield Fly Rule", settingKey: "specialPlay", enabled: true, priority: 60, probability: 80, description: "📋 INFIELD FLY RULE - Special situation!", category: "game_situations" },
      { sport: "MLB", alertType: "Balk Alert", settingKey: "specialPlay", enabled: true, priority: 65, probability: 70, description: "⚠️ BALK ALERT - Unusual pitcher movement!", category: "game_situations" },
      { sport: "MLB", alertType: "Extra Innings", settingKey: "extraInnings", enabled: true, priority: 90, probability: 100, description: "⚡ EXTRA INNINGS - Bonus baseball!", category: "game_situations" },
      { sport: "MLB", alertType: "Perfect Game Watch", settingKey: "perfectGame", enabled: true, priority: 100, probability: 100, description: "🎯 PERFECT GAME WATCH - Historic potential!", category: "game_situations" },
      { sport: "MLB", alertType: "No Hitter Watch", settingKey: "noHitter", enabled: true, priority: 95, probability: 100, description: "🚨 NO HITTER WATCH - Special performance!", category: "game_situations" },
      { sport: "MLB", alertType: "Cycle Watch", settingKey: "cycle", enabled: true, priority: 85, probability: 80, description: "🎯 CYCLE WATCH - Triple away from history!", category: "game_situations" },

      // NFL Engine Alerts (4 types)
      { sport: "NFL", alertType: "NFL Close Game", settingKey: "nflCloseGame", enabled: true, priority: 80, probability: 80, description: "🏈 ONE SCORE GAME! High-pressure moment", category: "nfl_situations" },
      { sport: "NFL", alertType: "Red Zone Situations", settingKey: "redZone", enabled: true, priority: 85, probability: 90, description: "🚨 RED ZONE ALERT! Touchdown territory", category: "nfl_situations" },
      { sport: "NFL", alertType: "Two Minute Warning", settingKey: "twoMinuteWarning", enabled: true, priority: 90, probability: 100, description: "⏰ TWO MINUTE WARNING! Crunch time", category: "nfl_situations" },
      { sport: "NFL", alertType: "Fourth Down", settingKey: "fourthDown", enabled: true, priority: 95, probability: 90, description: "🎯 4TH DOWN! Go for it or punt?", category: "nfl_situations" },

      // NBA Engine Alerts (5 types)
      { sport: "NBA", alertType: "Clutch Time", settingKey: "clutchTime", enabled: true, priority: 90, probability: 90, description: "🏀 CLUTCH TIME! Under 5 minutes in close game", category: "nba_situations" },
      { sport: "NBA", alertType: "Overtime", settingKey: "overtime", enabled: true, priority: 95, probability: 100, description: "⚡ OVERTIME! Extra basketball action", category: "nba_situations" },
      { sport: "NBA", alertType: "NBA Close Game", settingKey: "nbaCloseGame", enabled: true, priority: 80, probability: 80, description: "🔥 TIGHT CONTEST! Anyone's game", category: "nba_situations" },
      { sport: "NBA", alertType: "Buzzer Beater Prediction", settingKey: null, enabled: true, priority: 95, probability: 100, description: "🚨 BUZZER BEATER POTENTIAL - Final seconds magic!", category: "ai_predictions" },
      { sport: "NBA", alertType: "Three Point Opportunity", settingKey: null, enabled: true, priority: 80, probability: 100, description: "🎯 HIGH THREE-POINT PROBABILITY - Shooter ready!", category: "ai_predictions" },

      // NHL Engine Alerts (5 types)
      { sport: "NHL", alertType: "Power Play", settingKey: "powerPlay", enabled: true, priority: 85, probability: 90, description: "⚡ POWER PLAY! Man advantage opportunity", category: "nhl_situations" },
      { sport: "NHL", alertType: "Empty Net", settingKey: "emptyNet", enabled: true, priority: 95, probability: 100, description: "😨 EMPTY NET! Goalie pulled for extra attacker", category: "nhl_situations" },
      { sport: "NHL", alertType: "NHL Close Game", settingKey: "nhlCloseGame", enabled: true, priority: 75, probability: 70, description: "🏆 ONE-GOAL GAME! Tight contest", category: "nhl_situations" },
      { sport: "NHL", alertType: "Power Play Goal Prediction", settingKey: null, enabled: true, priority: 90, probability: 100, description: "⚡ POWER PLAY GOAL POTENTIAL - Man advantage opportunity!", category: "ai_predictions" },
      { sport: "NHL", alertType: "Game Winner Prediction", settingKey: null, enabled: true, priority: 95, probability: 100, description: "🏆 GAME WINNER POTENTIAL - Clutch goal opportunity!", category: "ai_predictions" },

      // Weather Engine Alerts (7 types)
      { sport: "WEATHER", alertType: "Wind Shift Alert", settingKey: null, enabled: true, priority: 80, probability: 100, description: "🌪️ WIND DIRECTION SHIFT - Game conditions changed!", category: "weather_conditions" },
      { sport: "WEATHER", alertType: "High Wind Alert", settingKey: null, enabled: true, priority: 85, probability: 100, description: "💨 HIGH WINDS - Wind speeds affecting play!", category: "weather_conditions" },
      { sport: "WEATHER", alertType: "Wind Speed Change", settingKey: null, enabled: true, priority: 75, probability: 100, description: "🌬️ WIND SPEED CHANGE - Conditions shifting!", category: "weather_conditions" },
      { sport: "WEATHER", alertType: "Temperature Drop", settingKey: null, enabled: true, priority: 70, probability: 100, description: "🥶 TEMPERATURE DROP - Cold weather affecting play!", category: "weather_conditions" },
      { sport: "WEATHER", alertType: "Weather Condition Change", settingKey: null, enabled: true, priority: 90, probability: 100, description: "🌦️ WEATHER CHANGE - Playing conditions altered!", category: "weather_conditions" },
      { sport: "WEATHER", alertType: "Perfect Weather", settingKey: null, enabled: true, priority: 60, probability: 30, description: "☀️ PERFECT CONDITIONS - Ideal weather for big plays!", category: "weather_conditions" },
      { sport: "WEATHER", alertType: "Dome Game", settingKey: null, enabled: true, priority: 40, probability: 20, description: "🏟️ DOME GAME - Weather not a factor", category: "weather_conditions" }
    ];

    console.log(`📊 Initializing ${alertControlsData.length} alert controls...`);
    
    // Insert all alert controls
    for (const alertData of alertControlsData) {
      try {
        await db.insert(globalAlertControls).values({
          sport: alertData.sport,
          alertType: alertData.alertType,
          settingKey: alertData.settingKey,
          enabled: alertData.enabled,
          priority: alertData.priority,
          probability: alertData.probability,
          description: alertData.description,
          category: alertData.category,
          adminNotes: null,
          updatedBy: "system"
        });
      } catch (error) {
        console.error(`❌ Failed to insert alert control ${alertData.sport}:${alertData.alertType}:`, error);
      }
    }

    console.log("✅ Global Alert Controls initialization complete!");
    
    // Log summary
    const final = await db.select().from(globalAlertControls);
    const summary = final.reduce((acc, control) => {
      acc[control.sport] = (acc[control.sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("📋 Summary by sport:", summary);
    console.log(`🎯 Total alert controls: ${final.length}`);
  }

  async getEnabledAlertTypes(sport?: string): Promise<string[]> {
    let query = db.select({ alertType: globalAlertControls.alertType, settingKey: globalAlertControls.settingKey })
      .from(globalAlertControls)
      .where(eq(globalAlertControls.enabled, true));
    
    if (sport) {
      query = query.where(and(eq(globalAlertControls.enabled, true), eq(globalAlertControls.sport, sport)));
    }
    
    const results = await query;
    // Return both settingKey-based and alertType-based identifiers
    return results.map(result => result.settingKey || result.alertType);
  }
}

export const storage = new DatabaseStorage();