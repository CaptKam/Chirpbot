import { db } from "./db";
import { eq, and, desc, count } from "drizzle-orm";
import { users, teams, settings, userMonitoredTeams, sportAlertSettings } from "../shared/schema";

// Complete storage interface for all operations
export const storage = {
  // User operations
  async getUserById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  },

  async getUserByUsername(username: string) {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0] || null;
  },

  async getUserByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || null;
  },

  async createUser(userData: any) {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  },

  async updateUser(id: string, userData: any) {
    const result = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  },


  // Team operations
  async getAllTeams() {
    return await db.select().from(teams);
  },

  async getTeamById(id: string) {
    const result = await db.select().from(teams).where(eq(teams.id, id));
    return result[0] || null;
  },

  async createTeam(teamData: any) {
    const result = await db.insert(teams).values(teamData).returning();
    return result[0];
  },

  async updateTeam(id: string, teamData: any) {
    const result = await db.update(teams)
      .set(teamData)
      .where(eq(teams.id, id))
      .returning();
    return result[0];
  },

  async deleteTeam(id: string) {
    await db.delete(teams).where(eq(teams.id, id));
  },

  // Settings operations
  async getSettings() {
    const result = await db.select().from(settings);
    return result[0] || null;
  },

  async upsertSettings(settingsData: any) {
    const existing = await this.getSettings();
    if (existing) {
      const result = await db.update(settings)
        .set(settingsData)
        .where(eq(settings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(settings).values(settingsData).returning();
      return result[0];
    }
  },

  // All the missing storage methods from routes.ts
  async getTeamsBySport(sport: string) {
    return await db.select().from(teams).where(eq(teams.sport, sport));
  },

  async getMonitoredTeams() {
    return await db.select().from(teams).where(eq(teams.monitored, true));
  },

  async toggleTeamMonitoring(id: string, monitored: boolean) {
    const result = await db.update(teams)
      .set({ monitored })
      .where(eq(teams.id, id))
      .returning();
    return result[0];
  },


  async getSettingsBySport(sport: string) {
    return await db.select().from(settings).where(eq(settings.sport, sport));
  },

  async getAllSettings() {
    return await db.select().from(settings);
  },


  async createSettings(settingsData: any) {
    const result = await db.insert(settings).values(settingsData).returning();
    return result[0];
  },

  async updateSettings(sport: string, updates: any) {
    const result = await db.update(settings)
      .set(updates)
      .where(eq(settings.sport, sport))
      .returning();
    return result[0];
  },

  // User monitored games operations
  async getUserMonitoredGames(userId: string, sport?: string) {
    let query = db.select().from(userMonitoredTeams).where(eq(userMonitoredTeams.userId, userId));
    
    if (sport) {
      query = query.where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.sport, sport)));
    }
    
    return await query;
  },

  async addUserMonitoredGame(data: any) {
    // Check if already exists
    const existing = await db.select()
      .from(userMonitoredTeams)
      .where(and(
        eq(userMonitoredTeams.userId, data.userId),
        eq(userMonitoredTeams.gameId, data.gameId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const result = await db.insert(userMonitoredTeams).values(data).returning();
    return result[0];
  },

  async removeUserMonitoredGame(userId: string, gameId: string) {
    await db.delete(userMonitoredTeams)
      .where(and(
        eq(userMonitoredTeams.userId, userId),
        eq(userMonitoredTeams.gameId, gameId)
      ));
  },

  // Telegram settings
  async updateUserTelegramSettings(userId: string, botToken: string, chatId: string, enabled: boolean) {
    const result = await db.update(users)
      .set({
        telegramBotToken: botToken,
        telegramChatId: chatId,
        telegramEnabled: enabled
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  },

  async isGameMonitoredByUser(userId: string, gameId: string) {
    const result = await db.select()
      .from(userMonitoredTeams)
      .where(and(
        eq(userMonitoredTeams.userId, userId),
        eq(userMonitoredTeams.gameId, gameId)
      ));
    return result.length > 0;
  },

  // Monitored games - for alert system
  async getAllMonitoredGames() {
    return await db.select().from(userMonitoredTeams);
  },

  // Sport alert settings operations
  async getUserSportAlertSettings(userId: string) {
    return await db.select().from(sportAlertSettings).where(eq(sportAlertSettings.userId, userId));
  },

  async getSportAlertSetting(userId: string, sport: string) {
    const result = await db.select()
      .from(sportAlertSettings)
      .where(and(eq(sportAlertSettings.userId, userId), eq(sportAlertSettings.sport, sport)));
    return result[0] || null;
  },

  async upsertSportAlertSetting(userId: string, sport: string, alertsEnabled: boolean) {
    const existing = await this.getSportAlertSetting(userId, sport);
    
    if (existing) {
      const result = await db.update(sportAlertSettings)
        .set({ alertsEnabled, updatedAt: new Date() })
        .where(and(eq(sportAlertSettings.userId, userId), eq(sportAlertSettings.sport, sport)))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(sportAlertSettings)
        .values({ userId, sport, alertsEnabled })
        .returning();
      return result[0];
    }
  }
};

export default storage;