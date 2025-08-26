import { Router, Request, Response, NextFunction } from "express";
import { tennisApi } from "../services/tennis-api";
import { db } from "../db";
import { userMonitoredMatches } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Simple auth middleware for tennis routes
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

export const tennisRouter = Router();

// Live matches list (for menu selection)
tennisRouter.get("/matches", requireAuth, async (req, res) => {
  try {
    const matches = await tennisApi.getLiveMatches();
    
    // Annotate with user monitoring flag
    const monitoredMatches = await db.select({
      matchId: userMonitoredMatches.matchId
    })
    .from(userMonitoredMatches)
    .where(
      and(
        eq(userMonitoredMatches.userId, req.session.userId!),
        eq(userMonitoredMatches.sport, 'TENNIS'),
        eq(userMonitoredMatches.isMonitoring, true)
      )
    );

    const monitoredSet = new Set(monitoredMatches.map(m => m.matchId));
    
    const annotatedMatches = matches.map(match => ({
      ...match,
      isMonitoring: monitoredSet.has(match.matchId)
    }));

    res.json({ matches: annotatedMatches });
  } catch (error) {
    console.error('Error fetching tennis matches:', error);
    res.status(500).json({ error: 'Failed to fetch tennis matches' });
  }
});

// Toggle monitoring for a match
tennisRouter.post("/toggle-monitoring", requireAuth, async (req, res) => {
  try {
    const { matchId, enable } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ error: "matchId required" });
    }

    await db.insert(userMonitoredMatches)
      .values({
        userId: req.session.userId!,
        sport: 'TENNIS',
        matchId,
        isMonitoring: !!enable
      })
      .onConflictDoUpdate({
        target: [userMonitoredMatches.userId, userMonitoredMatches.sport, userMonitoredMatches.matchId],
        set: {
          isMonitoring: !!enable
        }
      });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error toggling tennis match monitoring:', error);
    res.status(500).json({ error: 'Failed to toggle monitoring' });
  }
});

// Get user's monitored matches
tennisRouter.get("/monitored", requireAuth, async (req, res) => {
  try {
    const monitoredMatches = await db.select()
      .from(userMonitoredMatches)
      .where(
        and(
          eq(userMonitoredMatches.userId, req.session.userId!),
          eq(userMonitoredMatches.sport, 'TENNIS'),
          eq(userMonitoredMatches.isMonitoring, true)
        )
      );

    res.json({ matches: monitoredMatches });
  } catch (error) {
    console.error('Error fetching monitored matches:', error);
    res.status(500).json({ error: 'Failed to fetch monitored matches' });
  }
});