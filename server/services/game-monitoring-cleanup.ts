/**
 * Game Monitoring Cleanup Service
 * 
 * Automatically removes games from user monitoring when they reach "final" status
 * Integrates with Calendar Sync Service to detect status changes
 */

import { storage } from '../storage';

export class GameMonitoringCleanup {
  private isRunning = false;
  private calendarSyncService: any = null;
  
  constructor() {
    console.log('🧹 Game Monitoring Cleanup: Service initialized');
  }

  /**
   * Set reference to Calendar Sync Service to access game status
   */
  setCalendarSyncService(calendarSyncService: any) {
    this.calendarSyncService = calendarSyncService;
    console.log('🔗 Game Monitoring Cleanup: Connected to Calendar Sync Service');
  }

  /**
   * Start the cleanup service with periodic checks
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Game Monitoring Cleanup: Service already running');
      return;
    }

    this.isRunning = true;
    console.log('🧹 Game Monitoring Cleanup: Starting periodic cleanup service...');

    // Run cleanup immediately on start
    await this.performCleanup();

    // Schedule periodic cleanup every 10 minutes
    const interval = setInterval(async () => {
      if (this.isRunning) {
        await this.performCleanup();
      } else {
        clearInterval(interval);
      }
    }, 10 * 60 * 1000); // 10 minutes

    console.log('✅ Game Monitoring Cleanup: Service started - checking every 10 minutes');
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 Game Monitoring Cleanup: Service stopped');
  }

  /**
   * Perform cleanup of final games
   */
  async performCleanup(): Promise<{ removedGames: number; cleanedUsers: number }> {
    if (!this.calendarSyncService) {
      console.log('⚠️ Game Monitoring Cleanup: Calendar Sync Service not available, skipping cleanup');
      return { removedGames: 0, cleanedUsers: 0 };
    }

    try {
      console.log('🧹 Game Monitoring Cleanup: Starting cleanup scan...');

      // Get all currently monitored games
      const monitoredGames = await storage.getMonitoredGamesForCleanup();
      
      if (monitoredGames.length === 0) {
        console.log('📝 Game Monitoring Cleanup: No monitored games found');
        return { removedGames: 0, cleanedUsers: 0 };
      }

      console.log(`🔍 Game Monitoring Cleanup: Checking ${monitoredGames.length} monitored games for final status...`);

      let removedGames = 0;
      let cleanedUsers = 0;

      // Check each monitored game against calendar service
      for (const monitoredGame of monitoredGames) {
        const gameStatus = this.getGameStatusFromCalendar(monitoredGame.gameId, monitoredGame.sport);
        
        // Remove if:
        // 1. Game status is 'final' (explicitly finished)
        // 2. Game status is null (not tracked anymore, likely from previous days)
        const shouldRemove = gameStatus === 'final' || gameStatus === null;
        
        if (shouldRemove) {
          const reason = gameStatus === 'final' ? 'FINAL' : 'NOT_TRACKED (old game from previous day)';
          console.log(`🎯 Game Monitoring Cleanup: Game ${monitoredGame.gameId} (${monitoredGame.sport}) is ${reason} - removing from monitoring`);
          
          const removedCount = await storage.removeGameFromAllMonitoring(monitoredGame.gameId);
          
          if (removedCount > 0) {
            removedGames++;
            cleanedUsers += removedCount;
            console.log(`✅ Game Monitoring Cleanup: Removed game ${monitoredGame.gameId} from ${removedCount} user(s) monitoring`);
          }
        }
      }

      if (removedGames > 0) {
        console.log(`🧹 Game Monitoring Cleanup: Cleanup complete - removed ${removedGames} final games from ${cleanedUsers} user monitoring entries`);
      } else {
        console.log('📝 Game Monitoring Cleanup: No final games found to clean up');
      }

      return { removedGames, cleanedUsers };

    } catch (error) {
      console.error('❌ Game Monitoring Cleanup: Error during cleanup:', error);
      return { removedGames: 0, cleanedUsers: 0 };
    }
  }

  /**
   * Get game status from calendar service
   */
  private getGameStatusFromCalendar(gameId: string, sport: string): string | null {
    try {
      if (!this.calendarSyncService) return null;

      // Access the calendar service's game status
      const sportStates = this.calendarSyncService.sportStates;
      const sportKey = sport.toLowerCase();
      
      if (sportStates && sportStates[sportKey]) {
        const game = sportStates[sportKey].games.get(gameId);
        return game?.status || null;
      }

      return null;
    } catch (error) {
      console.error(`❌ Game Monitoring Cleanup: Error getting status for game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Manual cleanup trigger (for admin/debugging)
   */
  async triggerManualCleanup(): Promise<{ removedGames: number; cleanedUsers: number }> {
    console.log('🔧 Game Monitoring Cleanup: Manual cleanup triggered');
    return await this.performCleanup();
  }

  /**
   * Get cleanup service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasCalendarSync: !!this.calendarSyncService,
      lastCleanup: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const gameMonitoringCleanup = new GameMonitoringCleanup();