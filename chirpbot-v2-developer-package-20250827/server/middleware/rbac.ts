import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export type Role = "admin" | "manager" | "analyst" | "user";

// Role hierarchy - higher number = more permissions
const roleHierarchy: Record<Role, number> = {
  admin: 4,
  manager: 3,
  analyst: 2,
  user: 1,
};

// Middleware to check if user has required role or higher
export function requireRole(minRole: Role) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = req.session as any;
      if (!session.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const userRole = (user.role as Role) || "user";
      const userLevel = roleHierarchy[userRole] || 1;
      const requiredLevel = roleHierarchy[minRole];

      if (userLevel < requiredLevel) {
        return res.status(403).json({ 
          error: "Insufficient permissions", 
          required: minRole,
          current: userRole 
        });
      }

      // Add user info to request for convenience
      (req as any).user = user;
      next();
    } catch (error) {
      console.error("RBAC middleware error:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

// Helper middleware to log admin actions
export async function logAdminAction(
  userId: string, 
  action: string, 
  resource: string, 
  resourceId?: string,
  before?: any,
  after?: any,
  metadata?: any
) {
  try {
    await storage.createAuditLog({
      userId,
      action,
      resource,
      resourceId: resourceId || null,
      before: before || null,
      after: after || null,
      metadata: metadata || null,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
    // Don't throw - logging failure shouldn't break the action
  }
}