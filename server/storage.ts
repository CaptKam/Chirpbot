import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { 
  users, teams, settings, userMonitoredTeams, userAlertPreferences, 
  alertTypes, userAlertPermissions, gameStates, adminLogs,
  type InsertUserMonitoredTeam, type InsertUserAlertPreferences,
  type InsertAlertType, type InsertUserAlertPermission,
  type InsertGameState, type InsertAdminLog
} from "../shared/schema";

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

  async getUserMonitoredGamesBySport(userId: string, sport: string) {
    return await db.select().from(userMonitoredTeams)
      .where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.sport, sport)));
  },

  async getUserMonitoredGames(userId: string) {
    return await db.select().from(userMonitoredTeams)
      .where(eq(userMonitoredTeams.userId, userId));
  },

  async addUserMonitoredGame(gameData: InsertUserMonitoredTeam) {
    const result = await db.insert(userMonitoredTeams).values(gameData).returning();
    return result[0];
  },

  async removeUserMonitoredGame(userId: string, gameId: string) {
    const result = await db.delete(userMonitoredTeams)
      .where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.gameId, gameId)))
      .returning();
    return result[0] || null;
  },

  async isGameMonitoredByUser(userId: string, gameId: string) {
    const result = await db.select().from(userMonitoredTeams)
      .where(and(eq(userMonitoredTeams.userId, userId), eq(userMonitoredTeams.gameId, gameId)));
    return result.length > 0;
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

  // Get all monitored games across all users
  async getAllMonitoredGames() {
    return await db.select().from(userMonitoredTeams);
  },

  // Alerts operations (using raw SQL since alerts table not in schema)
  async getAllAlerts() {
    const result = await db.execute(sql`SELECT id, created_at FROM alerts ORDER BY created_at DESC`);
    return Array.isArray(result) ? result : (result.rows || []);
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
  },

  // User alert preferences operations
  async getUserAlertPreferences(userId: string) {
    return await db.select().from(userAlertPreferences).where(eq(userAlertPreferences.userId, userId));
  },

  async getUserAlertPreferencesBySport(userId: string, sport: string) {
    return await db.select().from(userAlertPreferences)
      .where(and(
        eq(userAlertPreferences.userId, userId),
        eq(userAlertPreferences.sport, sport)
      ));
  },

  async setUserAlertPreference(userId: string, sport: string, alertType: string, enabled: boolean) {
    // Use upsert pattern - try to update first, insert if not exists
    const existing = await db.select().from(userAlertPreferences)
      .where(and(
        eq(userAlertPreferences.userId, userId),
        eq(userAlertPreferences.sport, sport),
        eq(userAlertPreferences.alertType, alertType)
      ));

    if (existing.length > 0) {
      const result = await db.update(userAlertPreferences)
        .set({ enabled, updatedAt: new Date() })
        .where(and(
          eq(userAlertPreferences.userId, userId),
          eq(userAlertPreferences.sport, sport),
          eq(userAlertPreferences.alertType, alertType)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(userAlertPreferences)
        .values({ userId, sport, alertType, enabled })
        .returning();
      return result[0];
    }
  },

  async bulkSetUserAlertPreferences(userId: string, sport: string, preferences: Array<{alertType: string, enabled: boolean}>) {
    const results = [];
    for (const pref of preferences) {
      const result = await this.setUserAlertPreference(userId, sport, pref.alertType, pref.enabled);
      results.push(result);
    }
    return results;
  },

  // Admin: Alert Types management
  async getAllAlertTypes() {
    return await db.select().from(alertTypes).orderBy(alertTypes.sport, alertTypes.category, alertTypes.priority);
  },

  async getAlertTypesBySport(sport: string) {
    return await db.select().from(alertTypes).where(eq(alertTypes.sport, sport));
  },

  async getAlertTypeByKey(key: string) {
    const result = await db.select().from(alertTypes).where(eq(alertTypes.key, key));
    return result[0] || null;
  },

  async createAlertType(data: InsertAlertType) {
    const result = await db.insert(alertTypes).values(data).returning();
    return result[0];
  },

  async updateAlertType(id: string, data: Partial<InsertAlertType>) {
    const result = await db.update(alertTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertTypes.id, id))
      .returning();
    return result[0];
  },

  async deleteAlertType(id: string) {
    await db.delete(alertTypes).where(eq(alertTypes.id, id));
  },

  // Admin: User permissions management
  async getUserPermissions(userId: string) {
    return await db.select().from(userAlertPermissions)
      .where(eq(userAlertPermissions.userId, userId));
  },

  async getUserPermissionForAlertType(userId: string, alertTypeId: string) {
    const result = await db.select().from(userAlertPermissions)
      .where(and(
        eq(userAlertPermissions.userId, userId),
        eq(userAlertPermissions.alertTypeId, alertTypeId)
      ));
    return result[0] || null;
  },

  async setUserPermission(userId: string, alertTypeId: string, allowed: boolean) {
    const existing = await this.getUserPermissionForAlertType(userId, alertTypeId);
    
    if (existing) {
      const result = await db.update(userAlertPermissions)
        .set({ allowed })
        .where(and(
          eq(userAlertPermissions.userId, userId),
          eq(userAlertPermissions.alertTypeId, alertTypeId)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(userAlertPermissions)
        .values({ userId, alertTypeId, allowed })
        .returning();
      return result[0];
    }
  },

  async bulkSetUserPermissions(userId: string, permissions: Array<{alertTypeId: string, allowed: boolean}>) {
    const results = [];
    for (const perm of permissions) {
      const result = await this.setUserPermission(userId, perm.alertTypeId, perm.allowed);
      results.push(result);
    }
    return results;
  },

  // Admin: Game states for live monitoring
  async getAllGameStates() {
    return await db.select().from(gameStates).orderBy(desc(gameStates.updatedAt));
  },

  async getGameStatesBySport(sport: string) {
    return await db.select().from(gameStates)
      .where(eq(gameStates.sport, sport))
      .orderBy(desc(gameStates.updatedAt));
  },

  async getLiveGameStates() {
    return await db.select().from(gameStates)
      .where(eq(gameStates.status, 'LIVE'))
      .orderBy(desc(gameStates.updatedAt));
  },

  async upsertGameState(data: InsertGameState) {
    const existing = await db.select().from(gameStates)
      .where(and(
        eq(gameStates.sport, data.sport),
        eq(gameStates.extGameId, data.extGameId)
      ));

    if (existing.length > 0) {
      const result = await db.update(gameStates)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(gameStates.sport, data.sport),
          eq(gameStates.extGameId, data.extGameId)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(gameStates).values(data).returning();
      return result[0];
    }
  },

  // Admin: Activity logging
  async logAdminAction(userId: string, action: string, details: any) {
    const result = await db.insert(adminLogs)
      .values({ userId, action, details })
      .returning();
    return result[0];
  },

  async getAdminLogs(limit: number = 100) {
    return await db.select().from(adminLogs)
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit);
  },

  async getAdminLogsByUser(userId: string, limit: number = 50) {
    return await db.select().from(adminLogs)
      .where(eq(adminLogs.userId, userId))
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit);
  },

  // Admin: Get all users for management
  async getAllUsers() {
    return await db.select().from(users).orderBy(users.createdAt);
  },

  async getUsersByRole(role: string) {
    return await db.select().from(users).where(eq(users.role, role));
  },

  async updateUserRole(userId: string, role: string) {
    const result = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }
};

export default storage;