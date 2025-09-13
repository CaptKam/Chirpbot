import { BaseAlertModule, GameState, AlertResult } from '../base-engine';

export default class TestAlertModule extends BaseAlertModule {
  alertType = 'TEST_ALERT';
  sport = 'TEST';
  
  // Track last alert time
  private lastAlertTime: number = 0;
  private readonly ALERT_INTERVAL_MS = 300000; // 5 minutes

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 TEST ALERT check - Time since last: ${Date.now() - this.lastAlertTime}ms`);
    
    // Only for superadmin users (this should be checked by the caller)
    // For testing purposes, always check interval
    
    const now = Date.now();
    const timeSinceLastAlert = now - this.lastAlertTime;
    
    if (timeSinceLastAlert >= this.ALERT_INTERVAL_MS) {
      console.log(`🎯 TEST ALERT TRIGGERED! Last alert was ${Math.round(timeSinceLastAlert / 1000)}s ago`);
      this.lastAlertTime = now;
      return true;
    }
    
    console.log(`❌ Test Alert: Only ${Math.round(timeSinceLastAlert / 1000)}s since last alert (need ${this.ALERT_INTERVAL_MS / 1000}s)`);
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const message = `🧪 TEST ALERT - System Working! | Time: ${timestamp} | Alert system is operational and generating alerts successfully.`;
    
    return {
      alertKey: `test_alert_${Date.now()}`,
      type: this.alertType,
      message,
      context: {
        timestamp,
        systemStatus: 'operational',
        testMode: true,
        generatedAt: now.toISOString(),
        sport: gameState.sport || 'TEST',
        gameId: gameState.gameId || 'test_game'
      },
      priority: 50 // Low priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 100; // Always certain when interval is met
  }
}