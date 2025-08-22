import { Router } from "express";
import { requireRole, logAdminAction } from "../middleware/rbac";
import { storage } from "../storage";
import { insertAiSettingsSchema, insertAiLearningLogSchema } from "@shared/schema";
import bcrypt from "bcryptjs";

export const adminRouter = Router();

// ===================
// Admin Authentication
// ===================

// Admin login - separate from regular user auth
adminRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    // Find user by username
    const user = await storage.getUserByUsername(username);
    
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password || '');
    
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Set admin session - use standard userId for RBAC middleware compatibility
    (req as any).session.userId = user.id;
    (req as any).session.adminUser = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    
    await logAdminAction(user.id, "admin_login", "session", undefined, null, null, { username });
    
    res.json({ message: "Login successful", user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Admin logout
adminRouter.post("/logout", async (req, res) => {
  try {
    (req as any).session.destroy((err: any) => {
      if (err) {
        console.error("Admin logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

// ===================
// AI Settings Routes  
// ===================

// Get AI settings for a specific sport
adminRouter.get("/ai-settings/:sport", requireRole("analyst"), async (req, res) => {
  try {
    const { sport } = req.params;
    const user = (req as any).user;
    
    let settings = await storage.getAiSettingsBySport(sport);
    
    // Create default settings if none exist
    if (!settings) {
      const defaultSettings = {
        sport: sport.toUpperCase(),
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
        updatedBy: user.id,
      };
      
      settings = await storage.createAiSettings(defaultSettings);
    }
    
    await logAdminAction(user.id, "view_ai_settings", "ai_settings", settings.id, null, null, { sport });
    
    res.json(settings);
  } catch (error) {
    console.error("Error fetching AI settings:", error);
    res.status(500).json({ error: "Failed to fetch AI settings" });
  }
});

// Update AI settings for a specific sport  
adminRouter.patch("/ai-settings/:sport", requireRole("manager"), async (req, res) => {
  try {
    const { sport } = req.params;
    const user = (req as any).user;
    const updates = req.body;
    
    // Get current settings for audit log
    const currentSettings = await storage.getAiSettingsBySport(sport);
    
    // Validate the updates
    const validatedUpdates = {
      ...updates,
      updatedBy: user.id,
      updatedAt: new Date(),
    };
    
    let updatedSettings;
    if (currentSettings) {
      updatedSettings = await storage.updateAiSettings(sport, validatedUpdates);
    } else {
      // Create new settings if none exist
      const newSettings = {
        sport: sport.toUpperCase(),
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
        ...validatedUpdates,
      };
      updatedSettings = await storage.createAiSettings(newSettings);
    }
    
    await logAdminAction(
      user.id, 
      "update_ai_settings", 
      "ai_settings", 
      updatedSettings?.id || undefined,
      currentSettings,
      updatedSettings,
      { sport }
    );
    
    res.json(updatedSettings);
  } catch (error) {
    console.error("Error updating AI settings:", error);
    res.status(500).json({ error: "Failed to update AI settings" });
  }
});

// Get all AI settings
adminRouter.get("/ai-settings", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const allSettings = await storage.getAllAiSettings();
    
    await logAdminAction(user.id, "view_all_ai_settings", "ai_settings", undefined, null, null);
    
    res.json(allSettings);
  } catch (error) {
    console.error("Error fetching all AI settings:", error);
    res.status(500).json({ error: "Failed to fetch AI settings" });
  }
});

// ===================
// AI Learning Logs Routes
// ===================

// Get AI learning logs with filtering
adminRouter.get("/ai-logs", requireRole("analyst"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { sport, alertType, limit } = req.query;
    
    let logs;
    if (sport && alertType) {
      logs = await storage.getAiLearningLogsByType(sport as string, alertType as string);
    } else if (sport) {
      logs = await storage.getAiLearningLogsBySport(sport as string);
    } else {
      const logLimit = limit ? parseInt(limit as string) : 50;
      logs = await storage.getRecentAiLearningLogs(logLimit);
    }
    
    await logAdminAction(user.id, "view_ai_logs", "ai_learning_logs", undefined, null, null, { sport, alertType, limit });
    
    res.json(logs);
  } catch (error) {
    console.error("Error fetching AI logs:", error);
    res.status(500).json({ error: "Failed to fetch AI learning logs" });
  }
});

// Update feedback for an AI learning log
adminRouter.patch("/ai-logs/:id/feedback", requireRole("analyst"), async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, feedbackText } = req.body;
    const user = (req as any).user;
    
    if (!feedback || feedback < 1 || feedback > 5) {
      return res.status(400).json({ error: "Feedback must be a rating from 1 to 5" });
    }
    
    const updatedLog = await storage.updateAiLearningLogFeedback(id, feedback, feedbackText);
    
    if (!updatedLog) {
      return res.status(404).json({ error: "AI learning log not found" });
    }
    
    await logAdminAction(
      user.id, 
      "update_ai_log_feedback", 
      "ai_learning_logs", 
      id,
      null,
      { feedback, feedbackText }
    );
    
    res.json(updatedLog);
  } catch (error) {
    console.error("Error updating AI log feedback:", error);
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

// ===================
// Audit Logs Routes
// ===================

// Get audit logs with filtering
adminRouter.get("/audit-logs", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { userId, resource, limit } = req.query;
    
    let logs;
    if (userId) {
      logs = await storage.getAuditLogsByUser(userId as string);
    } else if (resource) {
      logs = await storage.getAuditLogsByResource(resource as string);
    } else {
      const logLimit = limit ? parseInt(limit as string) : 100;
      logs = await storage.getRecentAuditLogs(logLimit);
    }
    
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// ===================
// User Management Routes
// ===================

// Get user by ID (for admin user management)
adminRouter.get("/users/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Don't return password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ===================
// Dashboard Stats Routes
// ===================

// Get admin dashboard statistics
adminRouter.get("/dashboard/stats", requireRole("analyst"), async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Get recent AI logs for stats
    const recentLogs = await storage.getRecentAiLearningLogs(100);
    const recentAuditLogs = await storage.getRecentAuditLogs(50);
    
    // Calculate stats
    const stats = {
      aiLogs: {
        total: recentLogs.length,
        successful: recentLogs.filter(log => log.success).length,
        withFeedback: recentLogs.filter(log => log.userFeedback !== null).length,
        avgConfidence: recentLogs.filter(log => log.confidence !== null)
          .reduce((sum, log, _, arr) => sum + (log.confidence || 0) / arr.length, 0),
      },
      byType: recentLogs.reduce((acc, log) => {
        acc[log.alertType] = (acc[log.alertType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySport: recentLogs.reduce((acc, log) => {
        acc[log.sport] = (acc[log.sport] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentActivity: recentAuditLogs.slice(0, 10),
    };
    
    await logAdminAction(user.id, "view_dashboard_stats", "dashboard");
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
});

// ===================
// Alert Settings Control Panel Routes
// ===================

// Get all users' settings for admin control panel
adminRouter.get("/settings/all", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Get all users and their settings
    const allUsers = await storage.getAllUsers();
    const allSettings = await storage.getAllSettings();
    
    // Group settings by sport (settings are currently global, not per user)
    const settingsMap = new Map();
    allSettings.forEach(setting => {
      settingsMap.set(setting.sport, setting);
    });
    
    // Build response with user data and settings
    const usersWithSettings = allUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      settings: {
        MLB: settingsMap.get('MLB') || null,
        NFL: settingsMap.get('NFL') || null,
        NBA: settingsMap.get('NBA') || null,
        NHL: settingsMap.get('NHL') || null,
      }
    }));
    
    await logAdminAction(user.id, "view_all_settings", "settings", undefined, null, null, { userCount: allUsers.length });
    
    res.json({ users: usersWithSettings });
  } catch (error) {
    console.error("Error fetching all settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Get default alert settings template
adminRouter.get("/settings/defaults", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Return default settings template for each sport
    const defaults = {
      MLB: {
        // Game Situations  
        risp: true,
        basesLoaded: true,
        runnersOnBase: true,
        closeGame: true,
        lateInning: true,
        extraInnings: false,
        
        // Scoring & Hitting
        homeRun: true,
        homeRunAlert: true,
        hits: false,
        scoring: true,
        
        // Player Performance
        starBatter: false, // Disabled to prevent duplicates
        powerHitter: true,
        eliteClutch: false,
        avgHitter: false,
        rbiMachine: false,
        strikeouts: false,
        
        // AI Predictions
        "Home Run Prediction": false,
        "Walk-off Prediction": false,
        "Clutch Hit Prediction": false,
        "Hot Streak Prediction": false,
        "Double Play Prediction": false,
        "Stolen Base Prediction": false,
        
        // Weather Physics
        "Weather Home Run Boost": false,
        "Weather Pitching Advantage": false,
        
        // Special Events
        noHitter: true,
        perfectGame: true,
        cycle: false,
        specialPlay: false,
        
        // Game Flow
        inningChange: false,
        
        // Advanced Analytics
        re24Advanced: false,
        mlbAIEnabled: true,
      },
      NFL: {
        redZone: true,
        nflCloseGame: true,
        fourthDown: true,
        twoMinuteWarning: true,
      },
      NBA: {
        clutchTime: true,
        nbaCloseGame: true,
        overtime: true,
      },
      NHL: {
        powerPlay: true,
        nhlCloseGame: true,
        emptyNet: true,
      }
    };
    
    await logAdminAction(user.id, "view_default_settings", "settings", undefined, null, null, {});
    
    res.json(defaults);
  } catch (error) {
    console.error("Error fetching default settings:", error);
    res.status(500).json({ error: "Failed to fetch default settings" });
  }
});

// Update user settings (admin override)
adminRouter.patch("/settings/:userId/:sport", requireRole("admin"), async (req, res) => {
  try {
    const { userId, sport } = req.params;
    const user = (req as any).user;
    const updates = req.body;
    
    // Get current settings for audit
    const currentSettings = await storage.getSettingsByUserAndSport(userId, sport);
    
    // Update or create settings
    let updatedSettings;
    if (currentSettings) {
      updatedSettings = await storage.updateUserSettings(userId, sport, updates);
    } else {
      updatedSettings = await storage.createUserSettings(userId, sport, updates);
    }
    
    await logAdminAction(
      user.id,
      "admin_update_user_settings",
      "settings",
      updatedSettings?.id,
      currentSettings,
      updatedSettings,
      { targetUserId: userId, sport }
    );
    
    res.json(updatedSettings);
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

// Bulk update settings for multiple users
adminRouter.post("/settings/bulk-update", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { userIds, sport, updates } = req.body;
    
    if (!userIds || !sport || !updates) {
      return res.status(400).json({ error: "Missing required fields: userIds, sport, updates" });
    }
    
    const results = [];
    
    for (const userId of userIds) {
      try {
        const currentSettings = await storage.getSettingsByUserAndSport(userId, sport);
        let updatedSettings;
        
        if (currentSettings) {
          updatedSettings = await storage.updateUserSettings(userId, sport, updates);
        } else {
          updatedSettings = await storage.createUserSettings(userId, sport, updates);
        }
        
        results.push({ userId, success: true, settings: updatedSettings });
      } catch (error) {
        results.push({ userId, success: false, error: String(error) });
      }
    }
    
    await logAdminAction(
      user.id,
      "bulk_update_settings",
      "settings",
      undefined,
      null,
      null,
      { userCount: userIds.length, sport, updatesApplied: updates }
    );
    
    res.json({ results, summary: { 
      total: userIds.length, 
      successful: results.filter(r => r.success).length, 
      failed: results.filter(r => !r.success).length 
    }});
  } catch (error) {
    console.error("Error bulk updating settings:", error);
    res.status(500).json({ error: "Failed to bulk update settings" });
  }
});

// Get alert statistics for admin dashboard
adminRouter.get("/settings/stats", requireRole("admin"), async (req, res) => {
  try {
    const user = (req as any).user;
    
    const stats = await storage.getAlertSettingsStats();
    
    await logAdminAction(user.id, "view_alert_stats", "settings", undefined, null, null, {});
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching alert stats:", error);
    res.status(500).json({ error: "Failed to fetch alert statistics" });
  }
});