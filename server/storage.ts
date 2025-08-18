import { type User, type InsertUser, type Team, type InsertTeam, type Alert, type InsertAlert, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Teams
  getAllTeams(): Promise<Team[]>;
  getTeamsBySport(sport: string): Promise<Team[]>;
  getMonitoredTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<Team>): Promise<Team | undefined>;
  toggleTeamMonitoring(id: string, monitored: boolean): Promise<Team | undefined>;

  // Alerts
  getAllAlerts(): Promise<Alert[]>;
  getAlertsBySport(sport: string): Promise<Alert[]>;
  getAlertsByType(type: string): Promise<Alert[]>;
  getRecentAlerts(limit?: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertSentToTelegram(id: string): Promise<void>;

  // Settings
  getSettingsBySport(sport: string): Promise<Settings | undefined>;
  getAllSettings(): Promise<Settings[]>;
  createSettings(settings: InsertSettings): Promise<Settings>;
  updateSettings(sport: string, updates: Partial<Settings>): Promise<Settings | undefined>;
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
          risp: sport === "MLB",
          homeRun: sport === "MLB",
          lateInning: sport === "MLB",
          redZone: sport === "NFL",
          clutchTime: sport === "NBA",
        },
        aiEnabled: true,
        aiConfidenceThreshold: 85,
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
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
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

  async getRecentAlerts(limit = 50): Promise<Alert[]> {
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
      aiContext: insertAlert.aiContext || null,
      aiConfidence: insertAlert.aiConfidence || null,
      gameInfo: {
        ...insertAlert.gameInfo,
        quarter: insertAlert.gameInfo.quarter as string | undefined,
        inning: insertAlert.gameInfo.inning as string | undefined,
        period: insertAlert.gameInfo.period as string | undefined,
      }
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async markAlertSentToTelegram(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.sentToTelegram = true;
      this.alerts.set(id, alert);
    }
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
      aiEnabled: insertSettings.aiEnabled ?? true,
      aiConfidenceThreshold: insertSettings.aiConfidenceThreshold ?? 85,
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
}

export const storage = new MemStorage();
