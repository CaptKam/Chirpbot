import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { users, teams, settings, userMonitoredTeams, userAlertPreferences, globalAlertSettings, systemConfiguration, type InsertUserMonitoredTeam, type InsertUserAlertPreferences, type InsertSystemConfiguration } from "../shared/schema";

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

  // Admin-specific user operations
  async getAllUsers() {
    return await db.select().from(users);
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

  // Global alert settings operations (admin only)
  async getGlobalAlertSettings(sport: string) {
    const result = await db.select().from(globalAlertSettings).where(eq(globalAlertSettings.sport, sport));
    // Convert array to object keyed by alertType
    const settings: Record<string, boolean> = {};
    result.forEach(row => {
      settings[row.alertType] = row.enabled;
    });
    return settings;
  },

  async setGlobalAlertSetting(sport: string, alertType: string, enabled: boolean, adminUserId: string) {
    // Use upsert pattern
    const existing = await db.select().from(globalAlertSettings)
      .where(and(
        eq(globalAlertSettings.sport, sport),
        eq(globalAlertSettings.alertType, alertType)
      ));

    if (existing.length > 0) {
      const result = await db.update(globalAlertSettings)
        .set({ enabled, updatedAt: new Date(), updatedBy: adminUserId })
        .where(and(
          eq(globalAlertSettings.sport, sport),
          eq(globalAlertSettings.alertType, alertType)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(globalAlertSettings)
        .values({ sport, alertType, enabled, updatedBy: adminUserId })
        .returning();
      return result[0];
    }
  },

  async bulkSetGlobalAlertSettings(sport: string, settings: Record<string, boolean>, adminUserId: string) {
    const results = [];
    for (const [alertType, enabled] of Object.entries(settings)) {
      const result = await this.setGlobalAlertSetting(sport, alertType, enabled, adminUserId);
      results.push(result);
    }
    return results;
  },

  async getAllGlobalAlertSettings() {
    return await db.select().from(globalAlertSettings);
  },

  // Check if a specific alert is globally enabled
  async isAlertGloballyEnabled(sport: string, alertType: string) {
    const result = await db.select().from(globalAlertSettings)
      .where(and(
        eq(globalAlertSettings.sport, sport),
        eq(globalAlertSettings.alertType, alertType)
      ));
    
    // If no record exists, it's enabled by default
    if (result.length === 0) return true;
    return result[0].enabled;
  },

  // System Configuration operations
  async getAllSystemConfigurations() {
    return await db.select().from(systemConfiguration);
  },

  async getSystemConfigurationsByCategory(category: string) {
    return await db.select().from(systemConfiguration)
      .where(eq(systemConfiguration.category, category));
  },

  async getSystemConfiguration(category: string, key: string) {
    const result = await db.select().from(systemConfiguration)
      .where(and(
        eq(systemConfiguration.category, category),
        eq(systemConfiguration.key, key)
      ));
    return result[0] || null;
  },

  async setSystemConfiguration(category: string, key: string, value: any, description?: string, adminUserId?: string) {
    // Use upsert pattern
    const existing = await db.select().from(systemConfiguration)
      .where(and(
        eq(systemConfiguration.category, category),
        eq(systemConfiguration.key, key)
      ));

    const configData = {
      category,
      key,
      value: JSON.stringify(value),
      description,
      updatedAt: new Date(),
      updatedBy: adminUserId
    };

    if (existing.length > 0) {
      const result = await db.update(systemConfiguration)
        .set(configData)
        .where(and(
          eq(systemConfiguration.category, category),
          eq(systemConfiguration.key, key)
        ))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(systemConfiguration)
        .values(configData)
        .returning();
      return result[0];
    }
  },

  async getSystemConfigValue(category: string, key: string, defaultValue: any = null) {
    const config = await this.getSystemConfiguration(category, key);
    if (!config) return defaultValue;
    return JSON.parse(config.value as string);
  },

  async bulkSetSystemConfiguration(configurations: Array<{category: string, key: string, value: any, description?: string}>, adminUserId?: string) {
    const results = [];
    for (const config of configurations) {
      const result = await this.setSystemConfiguration(
        config.category, 
        config.key, 
        config.value, 
        config.description, 
        adminUserId
      );
      results.push(result);
    }
    return results;
  }
};

export default storage;