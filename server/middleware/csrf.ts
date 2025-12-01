import express from "express";
import csrf from "csrf";

const tokens = new csrf();

export function generateCSRFToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.adminUserId) {
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = tokens.secretSync();
    }
    const token = tokens.create(req.session.csrfSecret);
    req.csrfToken = token;
  }
  next();
}

export function validateCSRF(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const secret = req.session?.csrfSecret;

  if (!token || !secret) {
    return res.status(403).json({ message: 'CSRF token missing' });
  }

  if (!tokens.verify(secret, token as string)) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  next();
}

export { tokens };
