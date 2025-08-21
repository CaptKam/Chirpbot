import type { Express } from 'express';
import { multiSourceAggregator } from '../services/multi-source-aggregator';

export function registerMultiSourceRoutes(app: Express) {
  // Get data source status for monitoring
  app.get('/api/admin/data-sources/status', async (req, res) => {
    try {
      const status = multiSourceAggregator.getSourceStatus();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        sources: status,
        summary: {
          mlb: {
            total: status.mlb.length,
            enabled: status.mlb.filter(s => s.enabled).length,
            failed: status.mlb.filter(s => s.failureCount > 0).length,
          },
          nfl: {
            total: status.nfl.length,
            enabled: status.nfl.filter(s => s.enabled).length,
            failed: status.nfl.filter(s => s.failureCount > 0).length,
          },
        },
      });
    } catch (error) {
      console.error('Error getting data source status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get data source status' 
      });
    }
  });

  // Enable a disabled data source
  app.post('/api/admin/data-sources/:sourceName/enable', async (req, res) => {
    try {
      const { sourceName } = req.params;
      multiSourceAggregator.enableSource(sourceName);
      
      res.json({
        success: true,
        message: `Data source ${sourceName} has been enabled`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error enabling data source:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to enable data source' 
      });
    }
  });

  // Test data source connectivity
  app.post('/api/admin/data-sources/:sport/test', async (req, res) => {
    try {
      const { sport } = req.params;
      const startTime = Date.now();
      
      let games: any[] = [];
      let sourceUsed = 'unknown';

      if (sport.toUpperCase() === 'MLB') {
        games = await multiSourceAggregator.getMLBGames();
        sourceUsed = 'MLB Multi-Source';
      } else if (sport.toUpperCase() === 'NFL') {
        games = await multiSourceAggregator.getNFLGames();
        sourceUsed = 'NFL Multi-Source';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported sport. Use MLB or NFL.',
        });
      }

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        sport: sport.toUpperCase(),
        sourceUsed,
        gamesFound: games.length,
        responseTimeMs: responseTime,
        timestamp: new Date().toISOString(),
        sampleGame: games[0] || null,
      });
    } catch (error) {
      console.error('Error testing data source:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to test data source',
        timestamp: new Date().toISOString(),
      });
    }
  });
}