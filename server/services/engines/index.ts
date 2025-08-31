/**
   * NEW: AlertPipeline processes game states for alert opportunities
   * Uses unified pipeline system for all sports
   */
  private async scanForAlertOpportunities(sport: string, gameId: string, gameState: any, engine: any): Promise<void> {
    try {
      console.log(`🔍 AlertPipeline: Analyzing ${sport} game ${gameId} for opportunities`);

      // Import unified AlertPipeline
      const { getAlertPipeline } = await import('../AlertPipeline');
      const pipeline = getAlertPipeline(null, (alert) => {
        if (this.onAlert) {
          this.onAlert(alert);
        }
      });

      // Convert engine game state to GenericGameState format
      const genericState = {
        gameId: gameId,
        sport: sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore || 0,
        awayScore: gameState.awayScore || 0,
        // Preserve sport-specific data
        ...gameState
      };

      // Process through unified pipeline
      const alert = await pipeline.processState(genericState);

      if (alert) {
        console.log(`✅ AlertPipeline: Alert created [${alert.debugId}] for ${sport} game ${gameId}`);
      } else {
        console.log(`📊 AlertPipeline: No alert generated for ${sport} game ${gameId}`);
      }

    } catch (error) {
      console.error(`❌ AlertPipeline: Failed to process ${sport} game ${gameId}:`, error);
    }
  }