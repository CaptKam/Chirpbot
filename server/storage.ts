import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { users, teams, settings, userMonitoredTeams, userAlertPreferences, globalAlertSettings, type InsertUserMonitoredTeam, type InsertUserAlertPreferences } from "../shared/schema";

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

  // Global alert settings for admin management  
  async getGlobalAlertSettings(sport: string) {
    try {
      // Check admin user preferences to get current global state
      const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
      
      if (adminUsers.length > 0) {
        const firstAdmin = adminUsers[0];
        const adminPrefs = await db.select()
          .from(userAlertPreferences)
          .where(and(
            eq(userAlertPreferences.userId, firstAdmin.id),
            eq(userAlertPreferences.sport, sport.toLowerCase())
          ));
        
        // Start with defaults
        const defaultSettings: Record<string, boolean> = {
          // MLB alerts - all enabled by default
          'RISP': true,
          'BASES_LOADED': true,
          'RUNNERS_1ST_2ND': true,
          'CLOSE_GAME': true,
          'CLOSE_GAME_LIVE': true,
          'LATE_PRESSURE': true,
          'HOME_RUN_LIVE': true,
          'HIGH_SCORING': true,
          'SHUTOUT': true,
          'BLOWOUT': true,
          'FULL_COUNT': true,
          'STRIKEOUT': true,
          // NFL alerts
          'RED_ZONE': true,
          'FOURTH_DOWN': true,
          'TWO_MINUTE_WARNING': true,
          // NBA alerts
          'CLUTCH_TIME': true,
          'OVERTIME': true,
          // NHL alerts
          'POWER_PLAY': true,
          'EMPTY_NET': true
        };

        // Apply admin's preferences as global settings
        adminPrefs.forEach(pref => {
          defaultSettings[pref.alertType] = pref.enabled;
        });

        console.log(`🔧 DEBUG: Global settings for ${sport} loaded from admin preferences:`, defaultSettings);
        return defaultSettings;
      }

      // Fallback to defaults if no admin found
      return {
        'RISP': true, 'BASES_LOADED': true, 'RUNNERS_1ST_2ND': true, 'CLOSE_GAME': true,
        'CLOSE_GAME_LIVE': true, 'LATE_PRESSURE': true, 'HOME_RUN_LIVE': true,
        'HIGH_SCORING': true, 'SHUTOUT': true, 'BLOWOUT': true, 'FULL_COUNT': true, 'STRIKEOUT': true,
        'RED_ZONE': true, 'FOURTH_DOWN': true, 'TWO_MINUTE_WARNING': true,
        'CLUTCH_TIME': true, 'OVERTIME': true, 'POWER_PLAY': true, 'EMPTY_NET': true
      };
    } catch (error) {
      console.error('Error getting global alert settings:', error);
      return {};
    }
  },

  async updateGlobalAlertSetting(sport: string, alertType: string, enabled: boolean, updatedBy: string) {
    try {
      console.log(`Global alert setting updated: ${sport}.${alertType} = ${enabled} by admin ${updatedBy}`);
      
      // When admin changes global settings, apply to all users (including admin)
      const users = await this.getAllUsers();
      
      for (const user of users) {
        try {
          await this.setUserAlertPreference(user.id, sport.toLowerCase(), alertType, enabled);
        } catch (userError) {
          console.error(`Failed to update ${alertType} for user ${user.id}:`, userError);
        }
      }
      
      console.log(`✅ Successfully updated ${sport}.${alertType} = ${enabled} for all ${users.length} users`);
      return;
    } catch (error) {
      console.error('Error updating global alert setting:', error);
      throw error;
    }
  },

  async updateGlobalAlertCategory(sport: string, alertKeys: string[], enabled: boolean, updatedBy: string) {
    try {
      console.log(`Global alert category updated: ${sport} [${alertKeys.join(',')}] = ${enabled} by admin ${updatedBy}`);
      
      // Apply each alert key change
      for (const alertKey of alertKeys) {
        await this.updateGlobalAlertSetting(sport, alertKey, enabled, updatedBy);
      }
      
      return;
    } catch (error) {
      console.error('Error updating global alert category:', error);
      throw error;
    }
  },

  async applyGlobalSettingsToAllUsers(sport: string, settings: Record<string, boolean>, updatedBy: string) {
    try {
      const users = await this.getAllUsers();
      let updatedCount = 0;
      
      for (const user of users) {
        try {
          // Convert settings to preferences format
          const preferences = Object.entries(settings).map(([alertType, enabled]) => ({
            alertType,
            enabled: enabled === true
          }));
          
          // Apply each preference
          for (const pref of preferences) {
            await this.setUserAlertPreference(user.id, sport.toLowerCase(), pref.alertType, pref.enabled);
          }
          
          updatedCount++;
        } catch (userError) {
          console.error(`Failed to update settings for user ${user.id}:`, userError);
        }
      }
      
      console.log(`Applied global ${sport} alert settings to ${updatedCount} users by admin ${updatedBy}`);
      return { usersUpdated: updatedCount, totalUsers: users.length };
    } catch (error) {
      console.error('Error applying global settings to all users:', error);
      throw error;
    }
  },

  async getMasterAlertEnabled() {
    try {
      // For now, return true by default
      return true;
    } catch (error) {
      console.error('Error getting master alert enabled:', error);
      return true;
    }
  },

  async setMasterAlertEnabled(enabled: boolean, updatedBy: string) {
    try {
      console.log(`Master alerts ${enabled ? 'enabled' : 'disabled'} by admin ${updatedBy}`);
      // For now, just log the change. In a full implementation, this would update the database
      return;
    } catch (error) {
      console.error('Error setting master alert enabled:', error);
      throw error;
    }
  }
};

export default storage;