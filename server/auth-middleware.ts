import { Request, Response, NextFunction } from "express";

// Extend Express session to include user
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
  }
}

// Middleware to require authentication
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  next();
};

// Middleware to require specific roles
export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get user from storage to check role
    const storage = (await import('./storage')).storage;
    const user = await storage.getUserById(req.session.userId);
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    const userRole = user.role || "user";
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  };
};

// Helper to check if user has permission for a specific alert type
export const checkAlertPermission = async (
  userId: string,
  alertTypeKey: string,
  storage: any
): Promise<boolean> => {
  const alertType = await storage.getAlertTypeByKey(alertTypeKey);
  if (!alertType) return false;

  const permission = await storage.getUserPermissionForAlertType(userId, alertType.id);
  
  // If user has specific permission, use it
  if (permission) {
    return permission.allowed;
  }
  
  // Otherwise, use the default for the alert type
  return alertType.enabledDefault;
};