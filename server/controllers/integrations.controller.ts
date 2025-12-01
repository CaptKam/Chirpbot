import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { requireAdminAuth, requireUserAuth } from '../middleware/auth';
import { validateCSRF } from '../middleware/csrf';
import { testTelegramConnection, TelegramConfig } from '../services/telegram';

const router = Router();

router.get('/api/telegram/debug', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    const telegramDebug = allUsers.map(user => ({
      username: user.username,
      id: user.id,
      telegramEnabled: user.telegramEnabled,
      hasToken: !!user.telegramBotToken && user.telegramBotToken !== 'default_key' && user.telegramBotToken !== 'test-token',
      tokenLength: user.telegramBotToken?.length || 0,
      tokenValue: user.telegramBotToken?.substring(0, 10) + '...' || 'MISSING',
      hasChatId: !!user.telegramChatId && user.telegramChatId !== 'default_key' && user.telegramChatId !== 'test-chat-id',
      chatId: user.telegramChatId || 'MISSING',
      isTestData: user.telegramBotToken === 'default_key' || user.telegramChatId === 'test-chat-id'
    }));

    const validUsers = telegramDebug.filter(u => u.telegramEnabled && u.hasToken && u.hasChatId && !u.isTestData);

    res.json({
      totalUsers: telegramDebug.length,
      validTelegramUsers: validUsers.length,
      users: telegramDebug.map(u => ({
        username: u.username,
        enabled: u.telegramEnabled,
        hasToken: u.hasToken,
        hasChatId: u.hasChatId,
        isTestData: u.isTestData
      }))
    });
  } catch (error) {
    console.error('Error debugging telegram:', error);
    res.status(500).json({ error: 'Failed to debug telegram' });
  }
});

router.post('/api/telegram/test', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { botToken, chatId } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({ message: 'Bot token and chat ID are required' });
    }

    const config: TelegramConfig = { botToken, chatId };
    const result = await testTelegramConnection(config);

    res.json(result);
  } catch (error) {
    console.error('Error testing telegram connection:', error);
    res.status(500).json({ message: 'Failed to test telegram connection' });
  }
});

router.post('/api/ai/cache/clear', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    console.log('🧹 Admin requested AI cache clear');

    const { unifiedAIProcessor } = await import('../services/unified-ai-processor');

    unifiedAIProcessor.clearCache();

    const stats = unifiedAIProcessor.getStats();

    res.json({
      message: 'AI cache cleared successfully',
      stats: {
        currentSize: stats.cache.size,
        currentHitRate: stats.cache.hitRate,
        totalRequests: stats.performance.totalRequests,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error clearing AI cache:', error);
    res.status(500).json({ error: 'Failed to clear AI cache' });
  }
});

router.get('/api/ai/performance/dashboard', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { unifiedAIProcessor } = await import('../services/unified-ai-processor');
    const stats = unifiedAIProcessor.getStats();

    const totalRequests = stats.performance.totalRequests;
    const aiUtilization = totalRequests > 0 ?
      (stats.performance.successRate / 100) : 0;

    const recommendations: string[] = [];
    if (stats.cache.hitRate < 30) {
      recommendations.push("Cache hit rate low - consider longer TTL or better key generation");
    }
    if (stats.performance.fallbackRate > 40) {
      recommendations.push("High fallback rate - review AI gating rules or increase timeout");
    }
    if (stats.performance.avgProcessingTime > 2000) {
      recommendations.push("High latency - consider batch processing or cache optimization");
    }

    res.json({
      dashboard: {
        cache: stats.cache,
        queue: stats.queue,
        performance: stats.performance,
        gating: stats.gating,
        sportMetrics: stats.sportMetrics,
        utilization: aiUtilization,
        recommendations,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching AI dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch AI dashboard' });
  }
});

router.get('/api/ai/cache/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { unifiedAIProcessor } = await import('../services/unified-ai-processor');
    const stats = unifiedAIProcessor.getStats();

    res.json({
      cache: stats.cache,
      queue: stats.queue,
      performance: stats.performance,
      gating: stats.gating,
      sportMetrics: stats.sportMetrics
    });
  } catch (error) {
    console.error('Error fetching AI cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch AI cache stats' });
  }
});

router.get('/api/ai/generative/metrics', async (req: Request, res: Response) => {
  try {
    const { unifiedAIProcessor } = await import('../services/unified-ai-processor');
    const metrics = unifiedAIProcessor.getPerformanceMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching AI metrics:', error);
    res.status(500).json({ error: 'Failed to fetch AI metrics' });
  }
});

router.get('/api/ai/health/metrics', async (req: Request, res: Response) => {
  try {
    const { unifiedAIProcessor } = await import('../services/unified-ai-processor');
    const health = unifiedAIProcessor.getHealthStatus();
    const metrics = unifiedAIProcessor.getPerformanceMetrics();

    res.json({
      status: health.status,
      health,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching AI health and metrics:', error);
    res.status(500).json({ error: 'Failed to fetch AI health and metrics' });
  }
});

export default router;
