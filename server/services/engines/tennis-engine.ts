import { BaseSportEngine, AlertConfig } from './base-engine';
import { storage } from '../../storage';
import { tennisApi, TennisGameState } from '../tennis-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { enhanceHighPriorityAlert } from '../ai-analysis';

export class TennisEngine extends BaseSportEngine {
  sport = 'TENNIS';
  monitoringInterval = 2000; // 2 seconds for tennis (faster paced than baseball)

  extractGameState(apiData: any): TennisGameState {
    return apiData; // Tennis API already returns properly formatted TennisGameState
  }

  getGameSpecificInfo(gameState: TennisGameState): any {
    return {
      players: gameState.players,
      currentSet: gameState.currentSet,
      score: gameState.score,
      gamesInSet: gameState.gamesInSet,
      sets: gameState.sets,
      serving: gameState.serving,
      tournament: gameState.tournament,
      surface: gameState.surface
    };
  }

  buildGameContext(gameState: TennisGameState, config: AlertConfig): any {
    return {
      matchId: gameState.matchId,
      players: gameState.players,
      currentSet: gameState.currentSet,
      score: gameState.score,
      gamesInSet: gameState.gamesInSet,
      sets: gameState.sets,
      serving: gameState.serving,
      tournament: gameState.tournament,
      surface: gameState.surface,
      isBreakPoint: gameState.isBreakPoint,
      isSetPoint: gameState.isSetPoint,
      isMatchPoint: gameState.isMatchPoint,
      isTiebreak: gameState.isTiebreak,
      alertType: config.type
    };
  }

  // Tennis alert configurations
  alertConfigs: AlertConfig[] = [
    {
      type: "Break Point",
      settingKey: "breakPoint",
      priority: 85,
      probability: 1.0,
      description: "🎾 BREAK POINT! Non-serving player one point from winning the game!",
      conditions: (state: TennisGameState) => state.isBreakPoint
    },
    {
      type: "Double Break Point",
      settingKey: "doubleBreakPoint", 
      priority: 90,
      probability: 1.0,
      description: "🔥 DOUBLE BREAK POINT! Multiple break point opportunities!",
      conditions: (state: TennisGameState) => state.isDoubleBreakPoint
    },
    {
      type: "Set Point",
      settingKey: "setPoint",
      priority: 95,
      probability: 1.0,
      description: "🏆 SET POINT! One game away from winning the set!",
      conditions: (state: TennisGameState) => state.isSetPoint
    },
    {
      type: "Match Point", 
      settingKey: "matchPoint",
      priority: 100,
      probability: 1.0,
      description: "🚨 MATCH POINT! One point away from victory!",
      conditions: (state: TennisGameState) => state.isMatchPoint
    },
    {
      type: "Tiebreak Start",
      settingKey: "tiebreakStart",
      priority: 80,
      probability: 1.0,
      description: "⚡ TIEBREAK! Set decided by first to 7 points!",
      conditions: (state: TennisGameState) => state.isTiebreak
    },
    {
      type: "Momentum Surge",
      settingKey: "momentumSurge",
      priority: 75,
      probability: 1.0,
      description: "📈 MOMENTUM SHIFT! Key moment in the match!",
      conditions: (state: TennisGameState) => this.detectMomentumShift(state)
    }
  ];

  async getLiveMatches(): Promise<TennisGameState[]> {
    try {
      const liveMatches = await tennisApi.getLiveMatches();
      const gameStates: TennisGameState[] = [];

      for (const match of liveMatches) {
        if (match.status === 'live') {
          const gameState = await tennisApi.getMatchDetails(match.matchId);
          if (gameState) {
            gameStates.push(gameState);
          }
        }
      }

      console.log(`🎾 Found ${gameStates.length} live tennis matches`);
      return gameStates;
    } catch (error) {
      console.error('Tennis API error:', error);
      return [];
    }
  }

  async processAlerts(triggeredAlerts: AlertConfig[], gameState: TennisGameState): Promise<void> {
    console.log(`🔍 Processing ${triggeredAlerts.length} tennis alerts for match ${gameState.matchId}`);

    // Check if any users are monitoring this match
    const monitoringUsers = await this.getUsersMonitoringMatch(gameState.matchId);
    
    if (monitoringUsers.length === 0) {
      console.log(`⏭️ No users monitoring match ${gameState.matchId}, skipping`);
      return;
    }

    console.log(`👥 ${monitoringUsers.length} users monitoring match ${gameState.matchId}: ${monitoringUsers.join(', ')}`);

    for (const config of triggeredAlerts) {
      console.log(`🚨 TENNIS Alert: ${config.type} for match ${gameState.matchId}`);
      await this.generateAlert(gameState, config, monitoringUsers);
    }
  }

  private async getUsersMonitoringMatch(matchId: string): Promise<string[]> {
    try {
      console.log(`🔍 Looking for users monitoring tennis match: ${matchId}`);
      const allMonitoredGames = await storage.getAllMonitoredGames();
      const matchingUsers = allMonitoredGames
        .filter(game => game.sport === 'TENNIS' && game.gameId === matchId)
        .map(game => game.userId);
      console.log(`👥 Found ${matchingUsers.length} users monitoring match ${matchId}: ${matchingUsers.join(', ')}`);
      return matchingUsers;
    } catch (error) {
      console.error('Error fetching users monitoring tennis match:', error);
      return [];
    }
  }

  private async generateAlert(
    gameState: TennisGameState, 
    config: AlertConfig,
    userIds: string[]
  ): Promise<void> {
    const alertId = randomUUID();
    
    // Create rich alert context
    const context = {
      match: {
        players: gameState.players,
        score: gameState.score,
        set: gameState.currentSet,
        games: gameState.gamesInSet,
        serving: gameState.serving,
        tournament: gameState.tournament
      }
    };

    let description = config.description;
    
    // Enhance description with context
    description = `${description}\n\n${gameState.players.home.name} vs ${gameState.players.away.name}\nSet ${gameState.currentSet}: ${gameState.gamesInSet.home}-${gameState.gamesInSet.away}\nScore: ${gameState.score.home} - ${gameState.score.away}`;
    
    if (gameState.tournament) {
      description += `\n📍 ${gameState.tournament}`;
    }

    // Enhanced AI analysis for high-priority alerts
    if (config.priority >= 85) {
      try {
        // Convert tennis context to format AI expects
        const aiContext = {
          homeTeam: gameState.players?.home?.name || 'Player 1',
          awayTeam: gameState.players?.away?.name || 'Player 2',
          score: { 
            home: gameState.gamesInSet?.home || 0, 
            away: gameState.gamesInSet?.away || 0 
          },
          inning: `Set ${gameState.currentSet || 1}`,
          outs: undefined
        };
        const aiEnhancement = await enhanceHighPriorityAlert(
          config.type,
          aiContext,
          description,
          config.priority
        );
        if (aiEnhancement && aiEnhancement.enhancedDescription) {
          description = aiEnhancement.enhancedDescription;
        }
      } catch (error) {
        console.error('AI enhancement failed:', error);
      }
    }

    // Store alert
    const alert = {
      id: alertId,
      type: config.type,
      title: `🎾 ${config.type}`,
      description,
      sport: 'TENNIS' as const,
      priority: config.priority,
      gameId: gameState.matchId,
      probability: config.probability,
      aiConfidence: null,
      timestamp: new Date(),
      seen: false,
      context: JSON.stringify(context),
      gameInfo: {
        status: 'live',
        homeTeam: gameState.players.home.name,
        awayTeam: gameState.players.away.name,
        quarter: undefined,
        inning: undefined,
        period: undefined,
        inningState: undefined,
        outs: undefined,
        balls: undefined,
        strikes: undefined,
        runners: undefined,
        bases: undefined,
        count: undefined,
        score: {
          home: gameState.gamesInSet?.home || 0,
          away: gameState.gamesInSet?.away || 0
        },
        set: gameState.currentSet,
        gameScore: {
          home: gameState.score?.home || '0',
          away: gameState.score?.away || '0'
        }
      }
    };

    await storage.createAlert(alert);

    // Broadcast Tennis alerts over WebSocket
    this.onAlert?.({
      type: 'alert',
      data: alert
    });

    // Send to monitoring users
    for (const userId of userIds) {
      // Check global tennis alert settings
      const settings = await storage.getSettingsBySport('TENNIS');
      if (settings?.alertTypes[config.settingKey] && settings.telegramEnabled) {
        await sendTelegramAlert(description);
      }
    }

    console.log(`✅ Tennis alert generated: ${config.type} for match ${gameState.matchId}`);
  }

  async monitor(): Promise<void> {
    try {
      console.log('🎾 Tennis engine monitoring live matches...');
      
      // Get live tennis matches
      const liveMatches = await this.getLiveMatches();
      console.log(`🎾 Found ${liveMatches.length} live tennis matches`);
      
      // Process each live match
      for (const gameState of liveMatches) {
        try {
          // Check for alert conditions
          const triggeredAlerts = await this.checkAlertConditions(gameState);
          
          if (triggeredAlerts.length > 0) {
            console.log(`🎾 Processing ${triggeredAlerts.length} alerts for match ${gameState.matchId}`);
            await this.processAlerts(triggeredAlerts, gameState);
          }
        } catch (error) {
          console.error(`🎾 Error processing match ${gameState.matchId}:`, error);
        }
      }
    } catch (error) {
      console.error('🎾 Tennis monitoring error:', error);
    }
  }

  private detectMomentumShift(state: TennisGameState): boolean {
    // Simple momentum detection - can be enhanced with more sophisticated logic
    const { gamesInSet, score } = state;
    
    // Close games (5-5, 4-4, etc.) with important points
    const isCloseSet = Math.abs(gamesInSet.home - gamesInSet.away) <= 1;
    const isImportantPoint = score.home === '40' || score.away === '40' || 
                            score.home === 'ADV' || score.away === 'ADV' ||
                            score.home === 'DEUCE';
    
    return isCloseSet && isImportantPoint;
  }
}