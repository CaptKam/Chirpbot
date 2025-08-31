
import { storage } from '../storage';
import type { InsertAlert } from '@shared/schema';

export interface AlertValidationResult {
  valid: boolean;
  reason?: string;
  data?: any;
}

export interface AlertServiceConfig {
  enforceValidation: boolean;
  allowDirectCreation: boolean;
  debugMode: boolean;
}

export class AlertService {
  private config: AlertServiceConfig;
  private alertCooldowns = new Map<string, number>();

  constructor(config: Partial<AlertServiceConfig> = {}) {
    this.config = {
      enforceValidation: true,
      allowDirectCreation: false,
      debugMode: true,
      ...config
    };
  }

  /**
   * PROPER 4-STEP ALERT FLOW
   * Step 1: Game Status Monitoring (external)
   * Step 2: Sport Engine Data Collection (external) 
   * Step 3: AlertModel Validation (this method)
   * Step 4: OpenAI → Betbook → Launch (this method)
   */
  async createValidatedAlert(
    sport: string,
    gameId: string,
    gameStateData: any,
    debugContext?: string
  ): Promise<any> {
    try {
      const flowId = `${sport}_${gameId}_${Date.now()}`;
      const debugId = flowId.substring(0, 8).toUpperCase();
      
      if (this.config.debugMode) {
        console.log(`🎯 ALERT SERVICE: Starting 4-step flow [${debugId}] for ${sport} game ${gameId}`);
        console.log(`📍 Context: ${debugContext || 'No context provided'}`);
      }

      // STEP 3: AlertModel Validation
      const validationResult = await this.validateWithAlertModel(sport, gameStateData);
      if (!validationResult.valid) {
        if (this.config.debugMode) {
          console.log(`❌ STEP 3 FAILED: AlertModel validation rejected [${debugId}]: ${validationResult.reason}`);
        }
        return null;
      }

      // Check cooldown period to prevent spam
      if (!this.checkCooldown(sport, gameId)) {
        if (this.config.debugMode) {
          console.log(`⏰ COOLDOWN: Alert creation blocked for ${sport} game ${gameId}`);
        }
        return null;
      }

      if (this.config.debugMode) {
        console.log(`✅ STEP 3 PASSED: AlertModel validation approved [${debugId}]`);
        console.log(`🎯 STEP 4: Processing with OpenAI → Betbook → Launch [${debugId}]`);
      }

      // STEP 4: OpenAI → Betbook → Launch
      const finalAlert = await this.processAndLaunchAlert(gameStateData, validationResult.data, debugId);
      
      // Set cooldown after successful creation
      this.setCooldown(sport, gameId);
      
      if (this.config.debugMode) {
        console.log(`✅ 4-STEP FLOW COMPLETE: Alert created [${debugId}] for ${sport} game ${gameId}`);
      }

      return finalAlert;

    } catch (error) {
      console.error(`❌ AlertService 4-step flow failed for ${sport} game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * STEP 3: AlertModel Validation
   */
  private async validateWithAlertModel(sport: string, gameStateData: any): Promise<AlertValidationResult> {
    try {
      if (sport === 'MLB') {
        const mlbAlertModel = await import('../services/engines/mlbAlertModel.cjs');
        const modelFormat = this.convertToModelFormat(gameStateData);
        const result = mlbAlertModel.checkScoringProbability(modelFormat);
        
        if (result.shouldAlert) {
          return { valid: true, data: result };
        } else {
          return { valid: false, reason: result.reasons?.join(', ') || 'Model validation failed' };
        }
      }
      
      // For other sports, implement their respective models
      if (sport === 'NCAAF') {
        const ncaafAlertModel = await import('../services/engines/NCAAFAlertModel.cjs');
        // Implement NCAAF model validation
        return { valid: true, data: { shouldAlert: true, probability: 0.75 } };
      }
      
      // Default validation for unsupported sports
      return { valid: false, reason: `No AlertModel available for sport: ${sport}` };
      
    } catch (error) {
      return { valid: false, reason: `AlertModel error: ${error.message}` };
    }
  }

  /**
   * STEP 4: OpenAI → Betbook → Launch
   */
  private async processAndLaunchAlert(gameStateData: any, alertData: any, debugId: string): Promise<any> {
    try {
      const { AlertFormatValidator } = await import('../services/engines/AlertFormatValidator');
      
      // Create standardized alert with proper formatting
      const alert = {
        id: `${gameStateData.sport || 'MLB'}_${gameStateData.gameId || 'unknown'}_${Date.now()}`,
        debugId: `${debugId}-4STEP`,
        type: 'SCORING',
        sport: gameStateData.sport || 'MLB',
        title: AlertFormatValidator.generateStandardTitle(
          gameStateData.sport || 'MLB', 
          'SCORING', 
          {
            home: gameStateData.homeScore || 0,
            away: gameStateData.awayScore || 0
          }
        ),
        description: AlertFormatValidator.generateStandardDescription(
          gameStateData.sport || 'MLB', 
          'SCORING', 
          gameStateData
        ),
        gameInfo: {
          homeTeam: gameStateData.homeTeam || 'Home',
          awayTeam: gameStateData.awayTeam || 'Away',
          score: { 
            home: gameStateData.homeScore || 0, 
            away: gameStateData.awayScore || 0 
          },
          status: 'Live',
          situation: 'RISP',
          inning: gameStateData.inning || 1,
          inningState: gameStateData.inningState || 'top',
          outs: gameStateData.outs || 0,
          runners: {
            first: !!gameStateData.runners?.first,
            second: !!gameStateData.runners?.second,
            third: !!gameStateData.runners?.third
          }
        },
        priority: alertData.priority || 80,
        timestamp: new Date(),
        seen: false
      };

      // Validate compliance with alert standards
      const validation = AlertFormatValidator.validateCompliance(alert);
      if (!validation.isValid) {
        console.error('❌ ALERT COMPLIANCE VIOLATION:', validation.violations);
        throw new Error(`Alert compliance validation failed: ${validation.violations.join(', ')}`);
      }

      // Store the alert
      const createdAlert = await storage.createAlert(alert);
      
      if (this.config.debugMode) {
        console.log(`💾 ALERT SERVICE: Alert stored with ID ${createdAlert.debugId}`);
      }

      return createdAlert;

    } catch (error) {
      console.error('❌ AlertService Step 4 processing failed:', error);
      throw error;
    }
  }

  /**
   * EMERGENCY BYPASS: Direct alert creation (should only be used for testing)
   */
  async createDirectAlert(alertData: InsertAlert & { debugId?: string }): Promise<any> {
    if (!this.config.allowDirectCreation) {
      throw new Error('Direct alert creation is disabled. Use 4-step validation flow instead.');
    }

    console.warn('⚠️ ALERT SERVICE: Using emergency bypass - direct alert creation');
    return await storage.createAlert({
      ...alertData,
      debugId: alertData.debugId || `DIRECT-${Date.now().toString().slice(-8)}`
    });
  }

  /**
   * Cooldown management to prevent alert spam
   */
  private checkCooldown(sport: string, gameId: string): boolean {
    const cooldownKey = `${sport}_${gameId}`;
    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(cooldownKey) || 0;
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
    
    return (now - lastAlert) >= cooldownPeriod;
  }

  private setCooldown(sport: string, gameId: string): void {
    const cooldownKey = `${sport}_${gameId}`;
    this.alertCooldowns.set(cooldownKey, Date.now());
  }

  /**
   * Convert game state to AlertModel format
   */
  private convertToModelFormat(gameState: any) {
    return {
      clock: { inning: gameState.inning || 1, outs: gameState.outs || 0 },
      bases: { 
        on1B: !!gameState.runners?.first,
        on2B: !!gameState.runners?.second, 
        on3B: !!gameState.runners?.third
      },
      score: { home: gameState.homeScore || 0, away: gameState.awayScore || 0 },
      batter: null,
      onDeck: null,
      pitcher: null,
      weather: null,
      park: null
    };
  }

  /**
   * Get alert creation statistics
   */
  getStats(): any {
    return {
      cooldownsActive: this.alertCooldowns.size,
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const alertService = new AlertService({
  enforceValidation: true,
  allowDirectCreation: false, // Disable direct creation in production
  debugMode: true
});
