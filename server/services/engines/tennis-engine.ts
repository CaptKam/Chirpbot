import { BaseSportEngine, AlertConfig } from './base-engine';
import { storage } from '../../storage';
import { tennisApi, TennisGameState } from '../tennis-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { enhanceHighPriorityAlert } from '../ai-analysis';

export class TennisEngine extends BaseSportEngine {
  sport = 'TENNIS';
  monitoringInterval = 2000; // 2 seconds for tennis (faster paced than baseball)

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

  async processAlerts(gameStates: TennisGameState[]): Promise<void> {
    console.log(`🔍 Processing alerts for ${gameStates.length} tennis matches`);

    for (const gameState of gameStates) {
      // Check if any users are monitoring this match
      const monitoringUsers = await this.getUsersMonitoringMatch(gameState.matchId);
      
      if (monitoringUsers.length === 0) {
        console.log(`⏭️ No users monitoring match ${gameState.matchId}, skipping`);
        continue;
      }

      console.log(`👥 ${monitoringUsers.length} users monitoring match ${gameState.matchId}`);

      for (const config of this.alertConfigs) {
        if (config.conditions(gameState)) {
          console.log(`🚨 TENNIS Alert condition met: ${config.type} for match ${gameState.matchId}`);
          
          await this.generateAlert(gameState, config, monitoringUsers);
        }
      }
    }
  }

  private async getUsersMonitoringMatch(matchId: string): Promise<string[]> {
    try {
      const monitoredMatches = await storage.getUsersMonitoringMatch(matchId, 'TENNIS');
      return monitoredMatches.map(m => m.userId);
    } catch (error) {
      console.error('Error getting users monitoring match:', error);
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
        const aiEnhancement = await enhanceHighPriorityAlert(
          config.type,
          description,
          context,
          'TENNIS'
        );
        if (aiEnhancement.enhancedDescription) {
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
      context: JSON.stringify(context)
    };

    await storage.createAlert(alert);

    // Send to monitoring users
    for (const userId of userIds) {
      // Check user's tennis alert settings
      const settings = await storage.getSettingsBySport(userId, 'TENNIS');
      if (settings?.alertTypes[config.settingKey] && settings.telegramEnabled) {
        await sendTelegramAlert(userId, description);
      }
    }

    console.log(`✅ Tennis alert generated: ${config.type} for match ${gameState.matchId}`);
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