/**
 * Migration Adapter - Bridges user-selected games to CalendarSyncService
 * Connects the 48 user-monitored games to active polling
 */

export class MigrationAdapter {
  private calendarSyncService: any = null;
  private gameStateManager: any = null;

  constructor() {
    // Will be initialized after CalendarSyncService is ready
  }

  // Initialize with existing services
  initialize(calendarSyncService: any, gameStateManager: any) {
    this.calendarSyncService = calendarSyncService;
    this.gameStateManager = gameStateManager;
    console.log('📋 MigrationAdapter: Connected to CalendarSyncService and GameStateManager');
  }

  // Get game data for API routes
  getGameData(sport?: string): any[] {
    if (!this.calendarSyncService) {
      console.warn('⚠️ MigrationAdapter: CalendarSyncService not available');
      return [];
    }

    try {
      // Get games from CalendarSyncService
      if (sport) {
        return this.calendarSyncService.getGamesBySource(sport.toUpperCase()) || [];
      } else {
        // Get all games across all sports
        const allGames: any[] = [];
        const sports = ['MLB'];
        
        for (const sportName of sports) {
          const sportGames = this.calendarSyncService.getGamesBySource(sportName) || [];
          allGames.push(...sportGames);
        }
        
        return allGames;
      }
    } catch (error) {
      console.error('❌ MigrationAdapter: Error getting game data:', error);
      return [];
    }
  }

  // Get metrics for monitoring
  getMetrics(): any {
    if (!this.calendarSyncService) {
      return {
        status: 'not_initialized',
        error: 'CalendarSyncService not available'
      };
    }

    try {
      return {
        status: 'active',
        timestamp: new Date().toISOString(),
        sports: ['MLB'],
        totalGames: this.getGameData().length,
        userMonitoringEnabled: true
      };
    } catch (error) {
      return {
        status: 'error', 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Force refresh a sport
  async forceRefresh(sport: string): Promise<void> {
    if (!this.calendarSyncService) {
      throw new Error('CalendarSyncService not available');
    }

    console.log(`📋 MigrationAdapter: Force refreshing ${sport.toUpperCase()}`);
    
    // Trigger calendar sync refresh for the sport
    if (this.calendarSyncService.forceRefresh) {
      await this.calendarSyncService.forceRefresh(sport.toUpperCase());
    } else {
      console.warn('⚠️ ForceRefresh method not available on CalendarSyncService');
    }
  }

  // Get status for health checks
  getStatus(): any {
    return {
      initialized: !!this.calendarSyncService,
      calendarSyncConnected: !!this.calendarSyncService,
      gameStateManagerConnected: !!this.gameStateManager,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const migrationAdapter = new MigrationAdapter();