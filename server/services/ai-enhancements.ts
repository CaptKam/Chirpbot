
import { BasicAI } from './basic-ai';

export interface AIEnhancementConfig {
  AI_ENHANCED_MESSAGES: boolean;
  AI_PREDICTIVE_AT_BAT: boolean;
  AI_SCORING_PROBABILITY: boolean;
  AI_SITUATION_ANALYSIS: boolean;
  AI_EVENT_SUMMARIES: boolean;
  AI_ROI_ALERTS: boolean;
}

export interface GameContext {
  homeTeam: string;
  awayTeam: string;
  inning: number;
  score: { home: number; away: number };
  baseRunners: string[];
  outs: number;
  batter?: {
    name: string;
    seasonHomeRuns: number;
    battingAverage: number;
  };
}

export class AIEnhancementService {
  private basicAI: BasicAI;

  constructor() {
    this.basicAI = new BasicAI();
    console.log('🚫 AI Enhancements: DISABLED - OpenAI integration turned off');
  }

  async enhanceAlert(
    alertType: string, 
    originalMessage: string, 
    gameContext: GameContext,
    userPreferences: AIEnhancementConfig
  ): Promise<string> {
    // AI is disabled - return original message
    console.log('🚫 AI Enhancement skipped - OpenAI disabled');
    return originalMessage;
  }

      // 2. Predictive At-Bat Analysis
      if (userPreferences.AI_PREDICTIVE_AT_BAT && gameContext.batter) {
        const prediction = await this.predictAtBatOutcome(gameContext);
        if (prediction) {
          enhancedMessage += `\n🔮 AI Prediction: ${prediction}`;
        }
      }

      // 3. Real-Time Scoring Probability
      if (userPreferences.AI_SCORING_PROBABILITY && gameContext.baseRunners.length > 0) {
        const scoringProb = await this.calculateScoringProbability(gameContext);
        if (scoringProb) {
          enhancedMessage += `\n📊 Scoring Probability: ${scoringProb}`;
        }
      }

      // 4. Game Situation Analysis
      if (userPreferences.AI_SITUATION_ANALYSIS) {
        const situationAnalysis = await this.analyzeSituation(gameContext);
        if (situationAnalysis) {
          enhancedMessage += `\n🎯 Situation: ${situationAnalysis}`;
        }
      }

      // 5. Advanced ROI Analysis
      if (userPreferences.AI_ROI_ALERTS && this.isROISituation(gameContext)) {
        const roiAnalysis = await this.generateROIAnalysis(gameContext);
        if (roiAnalysis) {
          enhancedMessage += `\n💰 ROI Analysis: ${roiAnalysis}`;
        }
      }

      return enhancedMessage;
    } catch (error) {
      console.error('AI Enhancement error:', error);
      return originalMessage; // Fallback to original message
    }
  }

  private async generateContextInsight(alertType: string, context: GameContext): Promise<string | null> {
    try {
      const prompt = `Baseball alert context for ${alertType}: ${context.homeTeam} vs ${context.awayTeam}, inning ${context.inning}, ${context.outs} outs. Give 8-word insight.`;
      return await this.basicAI.generateResponse(prompt);
    } catch {
      return null;
    }
  }

  private async predictAtBatOutcome(context: GameContext): Promise<string | null> {
    if (!context.batter) return null;
    
    try {
      const prompt = `Predict at-bat outcome: ${context.batter.name} (.${Math.round(context.batter.battingAverage * 1000)} avg, ${context.batter.seasonHomeRuns} HRs) with ${context.baseRunners.length} runners, ${context.outs} outs. 6-word prediction.`;
      return await this.basicAI.generateResponse(prompt);
    } catch {
      return null;
    }
  }

  private async calculateScoringProbability(context: GameContext): Promise<string | null> {
    try {
      // Simple probability calculation based on runners and outs
      let baseProb = 0;
      if (context.baseRunners.includes('3B')) baseProb += 60;
      if (context.baseRunners.includes('2B')) baseProb += 40;
      if (context.baseRunners.includes('1B')) baseProb += 20;
      
      // Adjust for outs
      baseProb = baseProb * (3 - context.outs) / 3;
      
      const probability = Math.min(85, Math.max(15, baseProb));
      return `${probability}% - ${context.baseRunners.length} runner${context.baseRunners.length > 1 ? 's' : ''} on base`;
    } catch {
      return null;
    }
  }

  private async analyzeSituation(context: GameContext): Promise<string | null> {
    try {
      const scoreDiff = Math.abs(context.score.home - context.score.away);
      const isLateInning = context.inning >= 7;
      const isCloseGame = scoreDiff <= 2;
      
      if (isLateInning && isCloseGame) {
        return 'High-pressure late inning situation';
      } else if (context.baseRunners.length >= 2) {
        return 'Prime scoring opportunity developing';
      } else if (context.outs === 2) {
        return 'Two-out pressure mounting';
      }
      
      return 'Standard game situation';
    } catch {
      return null;
    }
  }

  private isROISituation(context: GameContext): boolean {
    return (context.batter?.seasonHomeRuns || 0) >= 20 && context.baseRunners.length > 0;
  }

  private async generateROIAnalysis(context: GameContext): Promise<string | null> {
    try {
      if (!context.batter) return null;
      
      const powerFactor = context.batter.seasonHomeRuns >= 25 ? 'Elite' : 'High';
      const runners = context.baseRunners.length;
      
      return `${powerFactor} power + ${runners} runner${runners > 1 ? 's' : ''} = ROI opportunity`;
    } catch {
      return null;
    }
  }

  async summarizeRecentEvents(events: string[], gameContext: GameContext): Promise<string | null> {
    try {
      if (events.length === 0) return null;
      
      const prompt = `Summarize these recent baseball events for ${gameContext.homeTeam} vs ${gameContext.awayTeam}: ${events.join(', ')}. 8-word summary.`;
      return await this.basicAI.generateResponse(prompt);
    } catch {
      return null;
    }
  }
}
