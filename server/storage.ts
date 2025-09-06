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

  async deleteUser(userId: string) {
    try {
      console.log(`🗑️ Deleting user ${userId} and all related data...`);

      // Execute each deletion step separately to avoid multiple command error

      // Step 1: Delete user alert preferences
      await db.execute(sql`DELETE FROM user_alert_preferences WHERE user_id = ${userId}`);
      console.log(`🗑️ Deleted alert preferences for user ${userId}`);

      // Step 2: Delete user monitored teams  
      await db.execute(sql`DELETE FROM user_monitored_teams WHERE user_id = ${userId}`);
      console.log(`🗑️ Deleted monitored teams for user ${userId}`);

      // Step 3: Clear global alert settings references
      await db.execute(sql`UPDATE global_alert_settings SET updated_by = NULL WHERE updated_by = ${userId}`);
      console.log(`🗑️ Cleared global alert settings references for user ${userId}`);

      // Step 4: Delete audit logs if they exist (table may not exist, so wrap in try-catch)
      try {
        await db.execute(sql`DELETE FROM audit_logs WHERE user_id = ${userId}`);
        console.log(`🗑️ Deleted audit logs for user ${userId}`);
      } catch (auditError) {
        console.log(`📝 No audit logs table found or no logs to delete for user ${userId}`);
      }

      // Step 5: Delete the user
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
      console.log(`🗑️ Deleted user ${userId} from users table`);

      console.log(`✅ Successfully deleted user ${userId} and all related data`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting user ${userId}:`, error);
      throw error;
    }
  },

  async forceDeleteUser(userId: string) {
    try {
      console.log(`💀 FORCE DELETE: Completely removing user ${userId} from all tables...`);

      // Get user info first for logging
      const userInfo = await db.execute(sql`SELECT username, email FROM users WHERE id = ${userId}`);
      const username = userInfo.rows[0]?.username || 'Unknown';

      console.log(`💀 Force deleting user: ${username} (${userId})`);

      // Force delete from ALL possible tables that might reference the user
      const deletionSteps = [
        { table: 'user_alert_preferences', condition: `user_id = '${userId}'` },
        { table: 'user_monitored_teams', condition: `user_id = '${userId}'` },
        { table: 'user_monitored_games', condition: `user_id = '${userId}'` },
        { table: 'audit_logs', condition: `user_id = '${userId}'` },
        { table: 'user_sessions', condition: `user_id = '${userId}'` },
        { table: 'user_preferences', condition: `user_id = '${userId}'` },
        { table: 'user_settings', condition: `user_id = '${userId}'` },
      ];

      for (const step of deletionSteps) {
        try {
          const result = await db.execute(sql.raw(`DELETE FROM ${step.table} WHERE ${step.condition}`));
          console.log(`💀 Deleted from ${step.table}: ${(result as any).rowsAffected || 0} rows`);
        } catch (error) {
          console.log(`📝 Table ${step.table} not found or no data - continuing`);
        }
      }

      // Clear any references in other tables
      try {
        await db.execute(sql`UPDATE global_alert_settings SET updated_by = NULL WHERE updated_by = ${userId}`);
        console.log(`💀 Cleared global_alert_settings references`);
      } catch (error) {
        console.log(`📝 No global_alert_settings to update`);
      }

      // Final deletion of the user record
      const finalResult = await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
      console.log(`💀 Final user deletion: ${(finalResult as any).rowsAffected || 0} user records removed`);

      if ((finalResult as any).rowsAffected === 0) {
        console.log(`⚠️ User ${userId} was not found in users table - may have been already deleted`);
        return false;
      }

      console.log(`✅ FORCE DELETE COMPLETE: User ${username} (${userId}) has been completely removed`);
      return true;
    } catch (error) {
      console.error(`❌ Force delete failed for user ${userId}:`, error);
      throw error;
    }
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

  async addUserMonitMonitoredGame(gameData: InsertUserMonitoredTeam): Promise<void> {
    try {
      console.log(`💾 Inserting monitored game into database:`, gameData);

      // Check if already exists to prevent duplicates
      const existing = await db.select().from(userMonitoredTeams)
        .where(sql`user_id = ${gameData.userId} AND game_id = ${gameData.gameId}`);

      if (existing.length > 0) {
        console.log(`⚠️ Game already monitored by user: ${gameData.gameId}`);
        return;
      }

      const result = await db.insert(userMonitoredTeams).values(gameData);
      console.log(`✅ Successfully inserted monitored game:`, {
        userId: gameData.userId,
        gameId: gameData.gameId,
        teams: `${gameData.awayTeamName} @ ${gameData.homeTeamName}`
      });
    } catch (error) {
      console.error(`❌ Database error inserting monitored game:`, error);
      console.error(`❌ Failed gameData:`, gameData);
      throw error;
    }
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
        telegramEnabled: enabled,
        updatedAt: new Date()
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

  async addUserMonitMonitoredTeam(userId: string, gameId: string, sport: string, homeTeamName: string, awayTeamName: string) {
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
      console.log(`🔧 RULE 1: Updated user preference ${userId} ${sport}.${alertType} = ${enabled}`);
      return result[0];
    } else {
      const result = await db.insert(userAlertPreferences)
        .values({ userId, sport, alertType, enabled })
        .returning();
      console.log(`🔧 RULE 1: Created user preference ${userId} ${sport}.${alertType} = ${enabled}`);
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

  // Global alert settings removed - starting fresh

  // Get user's AI enhancement preferences
  async getUserAIPreferences(userId: string): Promise<any> {
    try {
      // System-level defaults for all AI features
      const aiPrefs = {
        AI_ENHANCED_MESSAGES: true,  // Default enabled
        AI_PREDICTIVE_AT_BAT: true,  // Default enabled
        AI_SCORING_PROBABILITY: true,  // Default enabled
        AI_SITUATION_ANALYSIS: true,  // Default enabled
        AI_EVENT_SUMMARIES: true,  // Default enabled
        AI_ROI_ALERTS: true  // Default enabled
      };

      // For system user, return defaults
      if (userId === 'system') {
        console.log(`🤖 AI Preferences for system: all enabled`);
        return aiPrefs;
      }

      const preferences = await db.select()
        .from(userAlertPreferences)
        .where(and(
          eq(userAlertPreferences.userId, userId),
          eq(userAlertPreferences.sport, 'mlb')
        ));

      preferences.forEach(pref => {
        if (pref.alertType.startsWith('AI_')) {
          aiPrefs[pref.alertType as keyof typeof aiPrefs] = pref.enabled;
        }
      });

      console.log(`🤖 AI Preferences for user ${userId}:`, aiPrefs);
      return aiPrefs;
    } catch (error) {
      console.error('Error getting user AI preferences:', error);
      return {
        AI_ENHANCED_MESSAGES: true,  // Fallback to enabled
        AI_PREDICTIVE_AT_BAT: true,
        AI_SCORING_PROBABILITY: true,
        AI_SITUATION_ANALYSIS: true,
        AI_EVENT_SUMMARIES: true,
        AI_ROI_ALERTS: true
      };
    }
  },

  // Check if alert is globally enabled by admin
  async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    try {
      const globalSettings = await this.getGlobalAlertSettings(sport);
      return globalSettings[alertType] !== false; // Default to enabled
    } catch (error) {
      console.error(`Error checking if alert ${alertType} is globally enabled for ${sport}:`, error);
      return true; // Default to true if error occurs
    }
  },

  // Get global alert settings for a specific sport
  async getGlobalAlertSettings(sport: string): Promise<Record<string, boolean>> {
    try {
      const results = await db.select().from(globalAlertSettings)
        .where(eq(globalAlertSettings.sport, sport));
      
      const settings: Record<string, boolean> = {};
      results.forEach(setting => {
        settings[setting.alertType] = setting.enabled;
      });
      
      return settings;
    } catch (error) {
      console.error(`Error fetching global alert settings for ${sport}:`, error);
      return {}; // Return empty object on error
    }
  },

  // Set global alert setting for a specific sport and alert type
  async setGlobalAlertSetting(sport: string, alertType: string, enabled: boolean, updatedBy?: string): Promise<void> {
    try {
      // Check if setting already exists
      const existing = await db.select().from(globalAlertSettings)
        .where(and(
          eq(globalAlertSettings.sport, sport),
          eq(globalAlertSettings.alertType, alertType)
        ));

      if (existing.length > 0) {
        // Update existing setting
        await db.update(globalAlertSettings)
          .set({ 
            enabled, 
            updatedAt: new Date(),
            updatedBy: updatedBy || null 
          })
          .where(and(
            eq(globalAlertSettings.sport, sport),
            eq(globalAlertSettings.alertType, alertType)
          ));
      } else {
        // Insert new setting
        await db.insert(globalAlertSettings)
          .values({
            sport,
            alertType,
            enabled,
            updatedBy: updatedBy || null
          });
      }
      
      console.log(`🔧 ADMIN: Global alert setting ${sport}.${alertType} = ${enabled}`);
    } catch (error) {
      console.error(`Error setting global alert setting ${sport}.${alertType}:`, error);
      throw error;
    }
  },

  // Get master alert enabled status (global on/off switch)
  async getMasterAlertEnabled(): Promise<boolean> {
    try {
      // Check if there's a global setting for master alerts
      const masterSetting = await db.select().from(globalAlertSettings)
        .where(and(
          eq(globalAlertSettings.sport, 'GLOBAL'),
          eq(globalAlertSettings.alertType, 'MASTER_ALERTS_ENABLED')
        ));

      if (masterSetting.length > 0) {
        return masterSetting[0].enabled;
      }
      
      // Default to enabled if no setting exists
      return true;
    } catch (error) {
      console.error('Error fetching master alert enabled status:', error);
      return true; // Default to enabled on error
    }
  },

  // Set master alert enabled status
  async setMasterAlertEnabled(enabled: boolean, updatedBy?: string): Promise<void> {
    try {
      await this.setGlobalAlertSetting('GLOBAL', 'MASTER_ALERTS_ENABLED', enabled, updatedBy);
      console.log(`🔧 ADMIN: Master alerts ${enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (error) {
      console.error('Error setting master alert enabled status:', error);
      throw error;
    }
  },

  // Get all global alert settings across all sports
  async getAllGlobalAlertSettings(): Promise<Record<string, Record<string, boolean>>> {
    try {
      const results = await db.select().from(globalAlertSettings);
      
      const settings: Record<string, Record<string, boolean>> = {};
      results.forEach(setting => {
        if (!settings[setting.sport]) {
          settings[setting.sport] = {};
        }
        settings[setting.sport][setting.alertType] = setting.enabled;
      });
      
      return settings;
    } catch (error) {
      console.error('Error fetching all global alert settings:', error);
      return {};
    }
  }
};

export default storage;