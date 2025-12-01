import express from "express";
import { storage } from "../storage";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    adminUserId?: string;
    csrfSecret?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
      isApiRequest?: boolean;
      csrfToken?: string;
    }
  }
}

export async function requireAuthentication(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.userId) {
    const user = await storage.getUserById(req.session.userId);
    if (user) {
      req.user = user;
      return next();
    }
  }
  res.status(401).json({ message: 'Authentication required' });
}

export async function requireUserAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.userId) {
    const user = await storage.getUserById(req.session.userId);
    if (user) {
      if (user.role === 'admin') {
        return res.status(403).json({
          error: 'User access only',
          message: 'Administrators must use the admin panel. Regular users only.'
        });
      }
      req.user = user;
      return next();
    }
  }
  res.status(401).json({ message: 'Authentication required' });
}

export async function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.adminUserId) {
    const admin = await storage.getUserById(req.session.adminUserId);
    if (admin && admin.role === 'admin') {
      req.user = admin;
      return next();
    }
  }
  res.status(401).json({ message: 'Admin authentication required' });
}
