import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuthentication, requireUserAuth } from "../middleware/auth";
import { insertUserMonitoredTeamSchema } from "@shared/schema";

const router = Router();

router.get('/api/games/today', async (req: Request, res: Response) => {
  try {
    const migrationAdapter = (global as any).migrationAdapter;
    if (!migrationAdapter) {
      return res.status(503).json({ message: 'Game service not available' });
    }

    const games = await migrationAdapter.getTodaysGames();
    res.json(games);
  } catch (error) {
    console.error('Error fetching today games:', error);
    res.status(500).json({ message: 'Failed to fetch games' });
  }
});

router.get('/api/games/multi-day', async (req: Request, res: Response) => {
  try {
    const migrationAdapter = (global as any).migrationAdapter;
    if (!migrationAdapter) {
      return res.status(503).json({ message: 'Game service not available' });
    }

    const days = parseInt(req.query.days as string) || 7;
    const games = await migrationAdapter.getMultiDayGames(days);
    res.json(games);
  } catch (error) {
    console.error('Error fetching multi-day games:', error);
    res.status(500).json({ message: 'Failed to fetch games' });
  }
});

router.get('/api/games/:gameId/enhanced', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const migrationAdapter = (global as any).migrationAdapter;
    if (!migrationAdapter) {
      return res.status(503).json({ message: 'Game service not available' });
    }

    const enhancedGame = await migrationAdapter.getEnhancedGame(gameId);
    res.json(enhancedGame);
  } catch (error) {
    console.error('Error fetching enhanced game:', error);
    res.status(500).json({ message: 'Failed to fetch enhanced game' });
  }
});

router.get('/api/games/:gameId/live', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const migrationAdapter = (global as any).migrationAdapter;
    if (!migrationAdapter) {
      return res.status(503).json({ message: 'Game service not available' });
    }

    const liveData = await migrationAdapter.getLiveGameData(gameId);
    res.json(liveData);
  } catch (error) {
    console.error('Error fetching live game data:', error);
    res.status(500).json({ message: 'Failed to fetch live game data' });
  }
});

router.post('/api/games/monitor', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { gameId, sport, homeTeam, awayTeam } = req.body;

    const validation = insertUserMonitoredTeamSchema.safeParse({
      userId,
      gameId,
      sport: sport || 'UNKNOWN',
      homeTeamName: homeTeam || 'TBD',
      awayTeamName: awayTeam || 'TBD'
    });

    if (!validation.success) {
      console.error('Validation failed:', validation.error.flatten());
      return res.status(400).json({
        message: 'Invalid game data',
        errors: validation.error.flatten()
      });
    }

    const existing = await storage.getUserMonitoredTeams(userId);
    const alreadyMonitored = existing.some(g => g.gameId === gameId);

    if (alreadyMonitored) {
      return res.status(409).json({ message: 'Game already being monitored' });
    }

    await storage.addUserMonitoredTeam(
      userId,
      validation.data.gameId,
      validation.data.sport,
      validation.data.homeTeamName,
      validation.data.awayTeamName
    );

    console.log(`Game ${gameId} added to monitoring for user ${userId}`);

    res.status(201).json({
      message: 'Game added to monitoring',
      gameId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding game to monitor:', error);
    res.status(500).json({ message: 'Failed to add game to monitoring' });
  }
});

router.get('/api/games/monitored', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const monitoredGames = await storage.getUserMonitoredTeams(userId);

    res.json({
      games: monitoredGames,
      count: monitoredGames.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching monitored games:', error);
    res.status(500).json({ message: 'Failed to fetch monitored games' });
  }
});

router.delete('/api/games/monitor/:gameId', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { gameId } = req.params;

    await storage.removeUserMonitoredTeam(userId, gameId);

    console.log(`Game ${gameId} removed from monitoring for user ${userId}`);

    res.json({
      message: 'Game removed from monitoring',
      gameId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error removing game from monitor:', error);
    res.status(500).json({ message: 'Failed to remove game from monitoring' });
  }
});

router.get('/api/nfl/possession/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
    const nflEngine = engineLifecycleManager.getEngine('NFL') as any;

    if (!nflEngine || !nflEngine.getPossessionStats) {
      return res.status(404).json({ error: 'NFL engine not available' });
    }

    const stats = nflEngine.getPossessionStats(gameId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/ncaaf/possession/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
    const ncaafEngine = engineLifecycleManager.getEngine('NCAAF') as any;

    if (!ncaafEngine || !ncaafEngine.getPossessionStats) {
      return res.status(404).json({ error: 'NCAAF engine not available' });
    }

    const stats = ncaafEngine.getPossessionStats(gameId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/nfl/timeouts/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
    const nflEngine = engineLifecycleManager.getEngine('NFL') as any;

    if (!nflEngine || !nflEngine.getTimeoutStats) {
      return res.status(404).json({ error: 'NFL engine not available' });
    }

    const stats = nflEngine.getTimeoutStats(gameId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/ncaaf/timeouts/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
    const ncaafEngine = engineLifecycleManager.getEngine('NCAAF') as any;

    if (!ncaafEngine || !ncaafEngine.getTimeoutStats) {
      return res.status(404).json({ error: 'NCAAF engine not available' });
    }

    const stats = ncaafEngine.getTimeoutStats(gameId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/cfl/timeouts/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
    const cflEngine = engineLifecycleManager.getEngine('CFL') as any;

    if (!cflEngine || !cflEngine.getTimeoutStats) {
      return res.status(404).json({ error: 'CFL engine not available' });
    }

    const stats = cflEngine.getTimeoutStats(gameId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/ncaaf/possession', async (req: Request, res: Response) => {
  try {
    const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
    const ncaafEngine = engineLifecycleManager.getEngine('NCAAF') as any;

    if (!ncaafEngine || !ncaafEngine.getAllPossessionStats) {
      return res.status(404).json({ error: 'NCAAF engine not available' });
    }

    const stats = ncaafEngine.getAllPossessionStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/server-date', async (req: Request, res: Response) => {
  const now = new Date();
  const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = pacificFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const pacificDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const pacificTime = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

  res.json({
    serverTime: now.toISOString(),
    pacificDate,
    pacificTime,
    timezone: 'America/Los_Angeles'
  });
});

router.get('/api/teams', async (req: Request, res: Response) => {
  try {
    const teams = await storage.getAllTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ message: 'Failed to fetch teams' });
  }
});

router.get('/api/teams/:sport', async (req: Request, res: Response) => {
  try {
    const { sport } = req.params;
    const teams = await storage.getTeamsBySport(sport.toUpperCase());
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams by sport:', error);
    res.status(500).json({ message: 'Failed to fetch teams' });
  }
});

router.post('/api/teams', async (req: Request, res: Response) => {
  try {
    const team = await storage.createTeam(req.body);
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ message: 'Failed to create team' });
  }
});

router.put('/api/teams/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const team = await storage.updateTeam(id, req.body);
    res.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ message: 'Failed to update team' });
  }
});

router.delete('/api/teams/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTeam(id);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ message: 'Failed to delete team' });
  }
});

export default router;
