import { db } from "./db";
import { eq, and, desc, count } from "drizzle-orm";
import { users, teams, alerts, settings, userMonitoredTeams } from "../shared/schema";

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

  // Alert operations  
  async createAlert(alertData: any) {
    // SAFETY CHECK: Reject fake alerts with Unknown teams
    if (alertData.game_info && 
        (alertData.game_info.homeTeam === 'Unknown' || 
         alertData.game_info.awayTeam === 'Unknown' ||
         alertData.game_info.homeTeam?.includes('Unknown') ||
         alertData.game_info.awayTeam?.includes('Unknown'))) {
      console.log('🚫 STORAGE: Rejected fake alert with Unknown teams');
      return null;
    }
    
    const result = await db.insert(alerts).values(alertData).returning();
    return result[0];
  },

  async getAllAlerts() {
    return await db.select().from(alerts).orderBy(desc(alerts.timestamp));
  },

  async getUnseenAlertsCount() {
    const result = await db.select({ count: count() }).from(alerts).where(eq(alerts.seen, false));
    return result[0]?.count || 0;
  },

  async updateAlertSeen(alertId: string, seen: boolean) {
    const result = await db.update(alerts)
      .set({ seen })
      .where(eq(alerts.id, alertId))
      .returning();
    return result[0];
  },

  async markAllAlertsSeen() {
    await db.update(alerts).set({ seen: true }).where(eq(alerts.seen, false));
  },

  async deleteAlert(alertId: string) {
    await db.delete(alerts).where(eq(alerts.id, alertId));
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

  async getAlertsBySport(sport: string) {
    return await db.select().from(alerts).where(eq(alerts.sport, sport)).orderBy(desc(alerts.timestamp));
  },

  async getAlertsByType(type: string) {
    return await db.select().from(alerts).where(eq(alerts.type, type)).orderBy(desc(alerts.timestamp));
  },

  async getRecentAlerts(limit: number = 50) {
    return await db.select().from(alerts).orderBy(desc(alerts.timestamp)).limit(limit);
  },

  async markAlertAsSeen(id: string) {
    await db.update(alerts).set({ seen: true }).where(eq(alerts.id, id));
  },

  async markAllAlertsAsSeen() {
    await db.update(alerts).set({ seen: true }).where(eq(alerts.seen, false));
  },

  async getSettingsBySport(sport: string) {
    return await db.select().from(settings).where(eq(settings.sport, sport));
  },

  async getAllSettings() {
    return await db.select().from(settings);
  },

  async getEnabledAlertKeysBySport(sport: string) {
    // Disabled - no alert generation
    return [];
  },

  async getMasterAlertControlsBySport(sport: string) {
    // Disabled - no alert generation  
    return [];
  },

  async getAllMasterAlertControls() {
    // Disabled - no alert generation
    return [];
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

  async getUserMonitoredGamesBySport(userId: string, sport: string) {
    // Disabled - no more monitoring chaos
    return [];
  },

  async getUserMonitoredGames(userId: string) {
    // Disabled - no more monitoring chaos
    return [];
  },

  async addUserMonitoredGame(gameData: any) {
    // Disabled - no more alert generation
    return null;
  },

  async removeUserMonitoredGame(userId: string, gameId: string) {
    // Disabled - no more alert generation
    return null;
  },

  async isGameMonitoredByUser(userId: string, gameId: string) {
    // Disabled - no more monitoring
    return false;
  },

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

  async getUser(userId: string) {
    const result = await db.select().from(users).where(eq(users.id, userId));
    return result[0] || null;
  },

  // Monitored games - simplified (no more engine chaos)
  async getAllMonitoredGames() {
    return [];
  },

  // User monitored teams
  async getUserMonitoredTeams(userId: string) {
    return await db.select().from(userMonitoredTeams).where(eq(userMonitoredTeams.userId, userId));
  },

  async addUserMonitoredTeam(userId: string, gameId: string, sport: string, homeTeamName: string, awayTeamName: string) {
    const result = await db.insert(userMonitoredTeams)
      .values({ userId, gameId, sport, homeTeamName, awayTeamName })
      .returning();
    return result[0];
  },

  async removeUserMonitoredTeam(userId: string, gameId: string) {
    await db.delete(userMonitoredTeams)
      .where(and(
        eq(userMonitoredTeams.userId, userId),
        eq(userMonitoredTeams.gameId, gameId)
      ));
  }
};

export default storage;