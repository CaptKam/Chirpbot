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
          console.log(`💀 Deleted from ${step.table}: ${result.rowsAffected || 0} rows`);
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
      console.log(`💀 Final user deletion: ${finalResult.rowsAffected || 0} user records removed`);
      
      if (finalResult.rowsAffected === 0) {
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

  // Global alert settings for admin management - FIXED ARCHITECTURE
  async getGlobalAlertSettings(sport: string) {
    try {
      // Use the proper globalAlertSettings table instead of admin personal preferences
      const globalSettings = await db.select()
        .from(globalAlertSettings)
        .where(eq(globalAlertSettings.sport, sport.toLowerCase()));

      // Build settings directly from database, defaulting to disabled if not in DB
      const defaultSettings: Record<string, boolean> = {};
      
      // Apply actual global settings from the database
      globalSettings.forEach(setting => {
        defaultSettings[setting.alertType] = setting.enabled;
      });

      // Architecture fixed: Now using proper globalAlertSettings table instead of admin preferences
      return defaultSettings;
    } catch (error) {
      console.error('Error getting global alert settings:', error);
      // Return all enabled defaults on error
      return {
        'RISP': true, 'BASES_LOADED': true, 'RUNNERS_1ST_2ND': true, 'CLOSE_GAME': true,
        'CLOSE_GAME_LIVE': true, 'LATE_PRESSURE': true, 'HOME_RUN_LIVE': true,
        'HIGH_SCORING': true, 'SHUTOUT': true, 'BLOWOUT': true, 'FULL_COUNT': true, 'STRIKEOUT': true,
        'POWER_HITTER': true, 'HOT_HITTER': true,
        'AI_ENHANCED_MESSAGES': true,
        'AI_PREDICTIVE_AT_BAT': true,
        'AI_SCORING_PROBABILITY': true,
        'AI_SITUATION_ANALYSIS': true,
        'AI_EVENT_SUMMARIES': true,
        'AI_ROI_ALERTS': true,
        'RED_ZONE': true, 'FOURTH_DOWN': true, 'TWO_MINUTE_WARNING': true,
        'NCAAF_KICKOFF': true, 'NCAAF_HALFTIME': true, 'NCAAF_TWO_MINUTE_WARNING': true,
        'CLUTCH_TIME': true, 'OVERTIME': true,
        'NFL_GAME_START': true, 'NFL_SECOND_HALF_KICKOFF': true,
        'WNBA_FOURTH_QUARTER': true, 'WNBA_CLOSE_GAME': true, 'WNBA_OVERTIME': true,
        'WNBA_HIGH_SCORING': true, 'WNBA_COMEBACK': true, 'WNBA_CLUTCH_PERFORMANCE': true
      };
    }
  },

  async updateGlobalAlertSetting(sport: string, alertType: string, enabled: boolean, updatedBy: string) {
    try {
      console.log(`🔧 FIXED ARCHITECTURE: Global setting updated: ${sport}.${alertType} = ${enabled} by admin ${updatedBy}`);

      // Use upsert pattern - check if global setting exists
      const existing = await db.select().from(globalAlertSettings)
        .where(and(
          eq(globalAlertSettings.sport, sport.toLowerCase()),
          eq(globalAlertSettings.alertType, alertType)
        ));

      if (existing.length > 0) {
        // Update existing global setting
        const result = await db.update(globalAlertSettings)
          .set({ enabled, updatedAt: new Date(), updatedBy })
          .where(and(
            eq(globalAlertSettings.sport, sport.toLowerCase()),
            eq(globalAlertSettings.alertType, alertType)
          ))
          .returning();
        console.log(`✅ ARCHITECTURE FIX: Updated global setting ${sport}.${alertType} = ${enabled}`);
        return result[0];
      } else {
        // Create new global setting
        const result = await db.insert(globalAlertSettings)
          .values({ sport: sport.toLowerCase(), alertType, enabled, updatedBy })
          .returning();
        console.log(`✅ ARCHITECTURE FIX: Created global setting ${sport}.${alertType} = ${enabled}`);
        return result[0];
      }
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
  },

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
      return globalSettings[alertType] === true;
    } catch (error) {
      console.error(`Error checking if alert ${alertType} is globally enabled for ${sport}:`, error);
      return false; // Default to false if error occurs
    }
  }
};

export default storage;