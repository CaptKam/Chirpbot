import { Router } from "express";
import { requireRole, logAdminAction } from "../middleware/rbac";
import { storage } from "../storage";
import { insertAiSettingsSchema, insertAiLearningLogSchema } from "@shared/schema";

export const adminRouter = Router();

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
      updatedSettings?.id,
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
    
    await logAdminAction(user.id, "view_all_ai_settings", "ai_settings");
    
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
    
    await logAdminAction(user.id, "view_ai_logs", "ai_learning_logs", null, null, null, { sport, alertType, limit });
    
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