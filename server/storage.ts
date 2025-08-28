import { type User, type InsertUser, type Team, type InsertTeam, type Alert, type InsertAlert, type Settings, type InsertSettings, type UserMonitoredTeam, type InsertUserMonitoredTeam, type AiSettings, type InsertAiSettings, type AiLearningLog, type InsertAiLearningLog, type AuditLog, type InsertAuditLog, type MasterAlertControl, type InsertMasterAlertControl, users, userMonitoredTeams, teams, alerts, settings, aiSettings, aiLearningLogs, auditLogs, masterAlertControls } from "@shared/schema";
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
  updateUserTelegramSettings(id: string, telegramBotToken: string, telegramChatId: string, enabled: boolean): Promise<User | undefined>;
  getUsersWithTelegramEnabled(): Promise<User[]>;

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

  // Master Alert Controls
  getAllMasterAlertControls(): Promise<MasterAlertControl[]>;
  getMasterAlertControlsBySport(sport: string): Promise<MasterAlertControl[]>;
  getMasterAlertControl(alertKey: string, sport: string): Promise<MasterAlertControl | undefined>;
  createMasterAlertControl(control: InsertMasterAlertControl): Promise<MasterAlertControl>;
  updateMasterAlertControl(alertKey: string, sport: string, updates: Partial<MasterAlertControl>): Promise<MasterAlertControl | undefined>;
  getEnabledAlertKeysBySport(sport: string): Promise<string[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private teams: Map<string, Team>;
  private alerts: Map<string, Alert>;
  private settings: Map<string, Settings>;
  private masterAlertControls: Map<string, MasterAlertControl>;

  constructor() {
    this.users = new Map();
    this.teams = new Map();
    this.alerts = new Map();
    this.settings = new Map();
    this.masterAlertControls = new Map();

    // Initialize with default teams and settings
    this.initializeDefaultData();
  }

  private initializeMasterAlertControls() {
    // MLB Master Alert Controls
    const mlbAlerts = [
      // Game Situations
      { alertKey: "risp", title: "RISP Alert", description: "Runners in scoring position", category: "Game Situations" },
      { alertKey: "closeGame", title: "Close Game Alert", description: "1-run games in late innings", category: "Game Situations" },
      { alertKey: "lateInning", title: "Late Inning Alert", description: "8th+ inning crucial moments", category: "Game Situations" },
      { alertKey: "runnersOnBase", title: "Runners On Base", description: "Any base runner situations", category: "Game Situations" },
      
      // Scoring Events
      { alertKey: "homeRun", title: "Home Run Situations", description: "High home run probability moments", category: "Scoring Events" },
      { alertKey: "homeRunAlert", title: "Home Run Alerts", description: "Actual home run notifications", category: "Scoring Events" },
      { alertKey: "hits", title: "Hit Alerts", description: "Base hit notifications", category: "Scoring Events" },
      { alertKey: "scoring", title: "Scoring Plays", description: "RBI and run-scoring events", category: "Scoring Events" },
      
      // Player Performance
      { alertKey: "strikeouts", title: "Strikeout Alerts", description: "Pitcher strikeout notifications", category: "Player Performance" },
      { alertKey: "powerHitter", title: "Power Hitter Alert", description: "Advanced HR probability analysis with platoon advantages, park factors & wind effects", category: "Player Performance" },
      { alertKey: "powerHitterOnDeck", title: "Power Hitter On Deck", description: "Tier A power bats on deck - Pre-alert for next at-bat", category: "Player Performance" },
      { alertKey: "starBatter", title: "Star Batter Alert", description: ".300+ AVG, 20+ HR, or .900+ OPS hitters", category: "Player Performance" },
      { alertKey: "eliteClutch", title: "Elite Clutch Hitter", description: "High OPS batters in pressure situations", category: "Player Performance" },
      { alertKey: "avgHitter", title: ".300+ Hitter Alert", description: "Premium contact hitters at bat", category: "Player Performance" },
      { alertKey: "rbiMachine", title: "RBI Machine Alert", description: "80+ RBI producers with scoring chances", category: "Player Performance" },
      { alertKey: "basesLoaded", title: "Bases Loaded", description: "Maximum scoring opportunity - all bases occupied", category: "Game Situations" },
      { alertKey: "extraInnings", title: "Extra Innings", description: "Game extends beyond 9th inning", category: "Game Situations" },
      
      // RE24+AI Hybrid System
      { alertKey: "useRE24System", title: "RE24+AI Hybrid System", description: "Advanced Run Expectancy analytics enhanced with AI predictions", category: "AI Predictions" },
      { alertKey: "re24Level1", title: "RE24 Level 1", description: "Basic situational analysis with AI enhancement", category: "AI Predictions" },
      { alertKey: "re24Level2", title: "RE24 Level 2", description: "Intermediate player analytics with contextual AI", category: "AI Predictions" },
      { alertKey: "re24Level3", title: "RE24 Level 3", description: "Elite sabermetrics with advanced AI predictions", category: "AI Predictions" },
      
      // Game Flow
      { alertKey: "inningChange", title: "Inning Changes", description: "New inning momentum shifts", category: "Game Flow" },
    ];

    // NFL Master Alert Controls
    const nflAlerts = [
      { alertKey: "redZone", title: "Red Zone Alert", description: "Team driving inside the 20-yard line", category: "Scoring Opportunities" },
      { alertKey: "nflCloseGame", title: "Close Game Alert", description: "One-score games in final quarter", category: "Game Situations" },
      { alertKey: "fourthDown", title: "Fourth Down Alert", description: "Critical fourth down decisions", category: "Critical Plays" },
      { alertKey: "twoMinuteWarning", title: "Two Minute Warning", description: "Game-deciding final drives", category: "Game Situations" },
    ];

    // NBA Master Alert Controls  
    const nbaAlerts = [
      { alertKey: "clutchTime", title: "Clutch Time Alert", description: "Final 2 minutes of close games", category: "Game Situations" },
      { alertKey: "nbaCloseGame", title: "Close Game Alert", description: "Single-digit games in 4th quarter", category: "Game Situations" },
      { alertKey: "overtime", title: "Overtime Alert", description: "Extra period situations", category: "Special Events" },
    ];

    // NHL Master Alert Controls
    const nhlAlerts = [
      { alertKey: "powerPlay", title: "Power Play Alert", description: "Man advantage situations", category: "Special Situations" },
      { alertKey: "nhlCloseGame", title: "Close Game Alert", description: "One-goal games in final period", category: "Game Situations" },
      { alertKey: "emptyNet", title: "Empty Net Alert", description: "Goalie pulled for extra attacker", category: "Special Situations" },
    ];

    // Create master alert controls for each sport
    [
      { sport: "MLB", alerts: mlbAlerts },
      { sport: "NFL", alerts: nflAlerts },
      { sport: "NBA", alerts: nbaAlerts },
      { sport: "NHL", alerts: nhlAlerts },
    ].forEach(({ sport, alerts }) => {
      alerts.forEach(alert => {
        const controlId = randomUUID();
        const key = `${sport}-${alert.alertKey}`;
        this.masterAlertControls.set(key, {
          id: controlId,
          sport,
          alertKey: alert.alertKey,
          displayName: alert.title,
          description: alert.description,
          category: alert.category,
          enabled: true,
          updatedBy: null,
          updatedAt: new Date(),
        });
      });
    });
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
          powerHitterOnDeck: false,
          
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
        aiEnabled: false,
      });
    });

    // Initialize Master Alert Controls for all sports
    this.initializeMasterAlertControls();
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
      telegramBotToken: null,
      telegramChatId: null,
      telegramEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserTelegramSettings(id: string, telegramBotToken: string, telegramChatId: string, enabled: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.telegramBotToken = telegramBotToken;
      user.telegramChatId = telegramChatId;
      user.telegramEnabled = enabled;
      user.updatedAt = new Date();
      this.users.set(id, user);
      return user;
    }
    return undefined;
  }

  async getUsersWithTelegramEnabled(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.telegramEnabled);
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
      pushNotificationsEnabled: insertSettings.pushNotificationsEnabled ?? true,
      aiEnabled: insertSettings.aiEnabled ?? false
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
      temperature: settings.temperature ?? 70,
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
      gameId: log.gameId ?? null,
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
      metadata: log.metadata ?? null,
      createdAt: new Date(),
    };
    return auditLog;
  }

  async getRecentAuditLogs(limit = 50): Promise<AuditLog[]> {
    return []; // Mock implementation
  }

  // Master Alert Control methods (Mock implementations for MemStorage)
  async getAllMasterAlertControls(): Promise<MasterAlertControl[]> {
    return Array.from(this.masterAlertControls.values());
  }

  async getMasterAlertControlsBySport(sport: string): Promise<MasterAlertControl[]> {
    return Array.from(this.masterAlertControls.values()).filter(control => control.sport === sport);
  }

  async getMasterAlertControl(alertKey: string, sport: string): Promise<MasterAlertControl | undefined> {
    const key = `${sport}-${alertKey}`;
    return this.masterAlertControls.get(key);
  }

  async createMasterAlertControl(control: InsertMasterAlertControl): Promise<MasterAlertControl> {
    const id = randomUUID();
    const masterControl: MasterAlertControl = {
      ...control,
      id,
      enabled: control.enabled ?? true,
      description: control.description ?? null,
      updatedBy: control.updatedBy ?? null,
      updatedAt: new Date(),
    };
    const key = `${control.sport}-${control.alertKey}`;
    this.masterAlertControls.set(key, masterControl);
    return masterControl;
  }

  async updateMasterAlertControl(alertKey: string, sport: string, updates: Partial<MasterAlertControl>): Promise<MasterAlertControl | undefined> {
    const key = `${sport}-${alertKey}`;
    const existing = this.masterAlertControls.get(key);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.masterAlertControls.set(key, updated);
    return updated;
  }

  async getEnabledAlertKeysBySport(sport: string): Promise<string[]> {
    return Array.from(this.masterAlertControls.values())
      .filter(control => control.sport === sport && control.enabled)
      .map(control => control.alertKey);
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize master alert controls when the database storage is created
    this.initializeMasterAlertControls().catch(console.error);
  }

  private async initializeMasterAlertControls() {
    try {
      // Check if controls already exist
      const existingControls = await db.select().from(masterAlertControls).limit(1);
      if (existingControls.length > 0) {
        return; // Already initialized
      }

      // MLB Master Alert Controls
      const mlbAlerts = [
        // Game Situations
        { alertKey: "risp", title: "RISP Alert", description: "Runners in scoring position", category: "Game Situations" },
        { alertKey: "closeGame", title: "Close Game Alert", description: "1-run games in late innings", category: "Game Situations" },
        { alertKey: "lateInning", title: "Late Inning Alert", description: "8th+ inning crucial moments", category: "Game Situations" },
        { alertKey: "runnersOnBase", title: "Runners On Base", description: "Any base runner situations", category: "Game Situations" },
        
        // Scoring Events
        { alertKey: "homeRun", title: "Home Run Situations", description: "High home run probability moments", category: "Scoring Events" },
        { alertKey: "homeRunAlert", title: "Home Run Alerts", description: "Actual home run notifications", category: "Scoring Events" },
        { alertKey: "hits", title: "Hit Alerts", description: "Base hit notifications", category: "Scoring Events" },
        { alertKey: "scoring", title: "Scoring Plays", description: "RBI and run-scoring events", category: "Scoring Events" },
        
        // Player Performance
        { alertKey: "strikeouts", title: "Strikeout Alerts", description: "Pitcher strikeout notifications", category: "Player Performance" },
        { alertKey: "powerHitterOnDeck", title: "Power Hitter On Deck", description: "Tier A power bats on deck - Pre-alert for next at-bat", category: "Player Performance" },
        
        // RE24+AI Hybrid System
        { alertKey: "useRE24System", title: "RE24+AI Hybrid System", description: "Advanced Run Expectancy analytics enhanced with AI predictions", category: "AI Predictions" },
        { alertKey: "re24Level1", title: "RE24 Level 1", description: "Basic situational analysis with AI enhancement", category: "AI Predictions" },
        { alertKey: "re24Level2", title: "RE24 Level 2", description: "Intermediate player analytics with contextual AI", category: "AI Predictions" },
        { alertKey: "re24Level3", title: "RE24 Level 3", description: "Elite sabermetrics with advanced AI predictions", category: "AI Predictions" },
        
        // Game Flow
        { alertKey: "inningChange", title: "Inning Changes", description: "New inning momentum shifts", category: "Game Flow" },
      ];

      // NFL Master Alert Controls
      const nflAlerts = [
        { alertKey: "redZone", title: "Red Zone Alert", description: "Team driving inside the 20-yard line", category: "Scoring Opportunities" },
        { alertKey: "nflCloseGame", title: "Close Game Alert", description: "One-score games in final quarter", category: "Game Situations" },
        { alertKey: "fourthDown", title: "Fourth Down Alert", description: "Critical fourth down decisions", category: "Critical Plays" },
        { alertKey: "twoMinuteWarning", title: "Two Minute Warning", description: "Game-deciding final drives", category: "Game Situations" },
      ];

      // NBA Master Alert Controls  
      const nbaAlerts = [
        { alertKey: "clutchTime", title: "Clutch Time Alert", description: "Final 2 minutes of close games", category: "Game Situations" },
        { alertKey: "nbaCloseGame", title: "Close Game Alert", description: "Single-digit games in 4th quarter", category: "Game Situations" },
        { alertKey: "overtime", title: "Overtime Alert", description: "Extra period situations", category: "Special Events" },
      ];

      // NHL Master Alert Controls
      const nhlAlerts = [
        { alertKey: "powerPlay", title: "Power Play Alert", description: "Man advantage situations", category: "Special Situations" },
        { alertKey: "nhlCloseGame", title: "Close Game Alert", description: "One-goal games in final period", category: "Game Situations" },
        { alertKey: "emptyNet", title: "Empty Net Alert", description: "Goalie pulled for extra attacker", category: "Special Situations" },
      ];

      // Create master alert controls for all sports
      const allAlerts = [
        ...mlbAlerts.map(alert => ({ ...alert, sport: "MLB" })),
        ...nflAlerts.map(alert => ({ ...alert, sport: "NFL" })),
        ...nbaAlerts.map(alert => ({ ...alert, sport: "NBA" })),
        ...nhlAlerts.map(alert => ({ ...alert, sport: "NHL" })),
      ];

      // Insert all controls into database
      if (allAlerts.length > 0) {
        await db.insert(masterAlertControls).values(
          allAlerts.map(alert => ({
            sport: alert.sport,
            alertKey: alert.alertKey,
            title: alert.title,
            description: alert.description,
            category: alert.category,
            enabled: true,
          }))
        );
        console.log(`✅ Initialized ${allAlerts.length} master alert controls`);
      }
    } catch (error) {
      console.error("Error initializing master alert controls:", error);
    }
  }

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

  async updateUserTelegramSettings(id: string, telegramBotToken: string, telegramChatId: string, enabled: boolean): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({
        telegramBotToken,
        telegramChatId,
        telegramEnabled: enabled,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUsersWithTelegramEnabled(): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(eq(users.telegramEnabled, true));
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
      priority: insertAlert.priority || insertAlert.gameInfo?.priority || 70, // Save to main priority column
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

  // Master Alert Control methods
  async getAllMasterAlertControls(): Promise<MasterAlertControl[]> {
    return await db.select().from(masterAlertControls);
  }

  async getMasterAlertControlsBySport(sport: string): Promise<MasterAlertControl[]> {
    return await db.select().from(masterAlertControls)
      .where(eq(masterAlertControls.sport, sport));
  }

  async getMasterAlertControl(alertKey: string, sport: string): Promise<MasterAlertControl | undefined> {
    const [control] = await db.select().from(masterAlertControls)
      .where(and(eq(masterAlertControls.alertKey, alertKey), eq(masterAlertControls.sport, sport)));
    return control || undefined;
  }

  async createMasterAlertControl(control: InsertMasterAlertControl): Promise<MasterAlertControl> {
    const [masterControl] = await db.insert(masterAlertControls)
      .values(control)
      .returning();
    return masterControl;
  }

  async updateMasterAlertControl(alertKey: string, sport: string, updates: Partial<MasterAlertControl>): Promise<MasterAlertControl | undefined> {
    const [updated] = await db.update(masterAlertControls)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(masterAlertControls.alertKey, alertKey), eq(masterAlertControls.sport, sport)))
      .returning();
    return updated || undefined;
  }

  async getEnabledAlertKeysBySport(sport: string): Promise<string[]> {
    const controls = await db.select({ alertKey: masterAlertControls.alertKey })
      .from(masterAlertControls)
      .where(and(eq(masterAlertControls.sport, sport), eq(masterAlertControls.enabled, true)));
    return controls.map(control => control.alertKey);
  }
}

export const storage = new DatabaseStorage();