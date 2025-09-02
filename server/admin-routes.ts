import { Router } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth-middleware";

const router = Router();

// Middleware to check admin access
const requireAdmin = requireRole(["admin"]);
const requireOperator = requireRole(["admin", "operator"]);

// Get all users (admin only)
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get users by role (admin only)
router.get("/users/by-role/:role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const users = await storage.getUsersByRole(role);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update user role (admin only)
router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "operator", "viewer", "user"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const updatedUser = await storage.updateUserRole(id, role);
    
    // Log admin action
    await storage.logAdminAction((req as any).user.id, "USER_ROLE_CHANGED", {
      targetUserId: id,
      newRole: role,
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// Get user permissions (admin only)
router.get("/users/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = await storage.getUserPermissions(id);
    
    // Include alert type details
    const permissionsWithDetails = await Promise.all(
      permissions.map(async (perm) => {
        const alertType = await storage.getAlertTypeByKey(perm.alertTypeId);
        return {
          ...perm,
          alertType,
        };
      })
    );
    
    res.json(permissionsWithDetails);
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({ error: "Failed to fetch user permissions" });
  }
});

// Update user permissions (admin only)
router.put("/users/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = req.body;

    const result = await storage.bulkSetUserPermissions(id, permissions);
    
    // Log admin action
    await storage.logAdminAction((req as any).user.id, "USER_PERMISSIONS_CHANGED", {
      targetUserId: id,
      permissions,
    });

    res.json(result);
  } catch (error) {
    console.error("Error updating user permissions:", error);
    res.status(500).json({ error: "Failed to update user permissions" });
  }
});

// Get all alert types
router.get("/alert-types", requireAuth, requireOperator, async (req, res) => {
  try {
    const { sport } = req.query;
    
    if (sport) {
      const alertTypes = await storage.getAlertTypesBySport(sport as string);
      res.json(alertTypes);
    } else {
      const alertTypes = await storage.getAllAlertTypes();
      res.json(alertTypes);
    }
  } catch (error) {
    console.error("Error fetching alert types:", error);
    res.status(500).json({ error: "Failed to fetch alert types" });
  }
});

// Update alert type (admin only)
router.patch("/alert-types/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedAlertType = await storage.updateAlertType(id, updates);
    
    // Log admin action
    await storage.logAdminAction((req as any).user.id, "ALERT_TYPE_UPDATED", {
      alertTypeId: id,
      updates,
    });

    res.json(updatedAlertType);
  } catch (error) {
    console.error("Error updating alert type:", error);
    res.status(500).json({ error: "Failed to update alert type" });
  }
});

// Get game states (operator access)
router.get("/game-states", requireAuth, requireOperator, async (req, res) => {
  try {
    const { sport, status } = req.query;
    
    if (sport) {
      const gameStates = await storage.getGameStatesBySport(sport as string);
      res.json(gameStates);
    } else if (status === "LIVE") {
      const gameStates = await storage.getLiveGameStates();
      res.json(gameStates);
    } else {
      const gameStates = await storage.getAllGameStates();
      res.json(gameStates);
    }
  } catch (error) {
    console.error("Error fetching game states:", error);
    res.status(500).json({ error: "Failed to fetch game states" });
  }
});

// Update game state (operator access)
router.put("/game-states", requireAuth, requireOperator, async (req, res) => {
  try {
    const gameState = req.body;
    const result = await storage.upsertGameState(gameState);
    res.json(result);
  } catch (error) {
    console.error("Error updating game state:", error);
    res.status(500).json({ error: "Failed to update game state" });
  }
});

// Get admin logs (admin only)
router.get("/logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, limit = 100 } = req.query;
    
    if (userId) {
      const logs = await storage.getAdminLogsByUser(userId as string, Number(limit));
      res.json(logs);
    } else {
      const logs = await storage.getAdminLogs(Number(limit));
      res.json(logs);
    }
  } catch (error) {
    console.error("Error fetching admin logs:", error);
    res.status(500).json({ error: "Failed to fetch admin logs" });
  }
});

export default router;