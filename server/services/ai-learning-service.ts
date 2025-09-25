
import { db } from '../db';
import { aiLearningPatterns, aiCrossSportInsights, aiModelPerformance, aiUserInteractions } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface LearningPattern {
  sport: string;
  alertType: string;
  gameContext: any;
  pattern: any;
  outcome: any;
  confidence?: number;
  userFeedback?: number;
}

export interface CrossSportInsight {
  primarySport: string;
  secondarySport: string;
  sharedConcept: string;
  insight: any;
  applicabilityScore?: number;
}

export interface UserInteraction {
  userId?: string;
  alertId?: string;
  sport: string;
  alertType: string;
  aiEnhanced: boolean;
  userRating?: number;
  userAction?: string;
  timeOnAlert?: number;
  followedRecommendation?: boolean;
}

export class AILearningService {
  // Store learning patterns from successful AI enhancements
  async storeLearningPattern(pattern: LearningPattern): Promise<void> {
    try {
      await db.insert(aiLearningPatterns).values({
        sport: pattern.sport,
        alertType: pattern.alertType,
        gameContext: pattern.gameContext,
        pattern: pattern.pattern,
        outcome: pattern.outcome,
        confidence: pattern.confidence?.toString(),
        userFeedback: pattern.userFeedback,
        successRate: '0.50', // Start at 50% baseline
        timesUsed: 0
      });
      
      console.log(`📚 AI Learning: Stored pattern for ${pattern.sport} ${pattern.alertType}`);
    } catch (error) {
      console.error('❌ AI Learning: Failed to store learning pattern:', error);
    }
  }

  // Retrieve successful patterns for similar game contexts
  async getSimilarPatterns(sport: string, alertType: string, gameContext: any): Promise<any[]> {
    try {
      const patterns = await db
        .select()
        .from(aiLearningPatterns)
        .where(and(
          eq(aiLearningPatterns.sport, sport),
          eq(aiLearningPatterns.alertType, alertType)
        ))
        .orderBy(desc(aiLearningPatterns.successRate))
        .limit(5);

      return patterns.map(p => ({
        pattern: p.pattern,
        outcome: p.outcome,
        confidence: parseFloat(p.confidence || '0'),
        successRate: parseFloat(p.successRate || '0'),
        timesUsed: p.timesUsed
      }));
    } catch (error) {
      console.error('❌ AI Learning: Failed to retrieve patterns:', error);
      return [];
    }
  }

  // Store cross-sport insights that apply to multiple sports
  async storeCrossSportInsight(insight: CrossSportInsight): Promise<void> {
    try {
      await db.insert(aiCrossSportInsights).values({
        primarySport: insight.primarySport,
        secondarySport: insight.secondarySport,
        sharedConcept: insight.sharedConcept,
        insight: insight.insight,
        applicabilityScore: insight.applicabilityScore?.toString(),
        validationCount: 0,
        successCount: 0
      });
      
      console.log(`🔗 AI Cross-Sport: Stored insight linking ${insight.primarySport} → ${insight.secondarySport}`);
    } catch (error) {
      console.error('❌ AI Cross-Sport: Failed to store insight:', error);
    }
  }

  // Get cross-sport insights applicable to current sport
  async getCrossSportInsights(sport: string, concept: string): Promise<any[]> {
    try {
      const insights = await db
        .select()
        .from(aiCrossSportInsights)
        .where(and(
          eq(aiCrossSportInsights.secondarySport, sport),
          eq(aiCrossSportInsights.sharedConcept, concept)
        ))
        .orderBy(desc(aiCrossSportInsights.applicabilityScore))
        .limit(3);

      return insights.map(i => ({
        fromSport: i.primarySport,
        insight: i.insight,
        applicabilityScore: parseFloat(i.applicabilityScore || '0'),
        validationCount: i.validationCount,
        successRate: i.validationCount > 0 ? (i.successCount / i.validationCount) : 0
      }));
    } catch (error) {
      console.error('❌ AI Cross-Sport: Failed to retrieve insights:', error);
      return [];
    }
  }

  // Track user interactions for feedback learning
  async recordUserInteraction(interaction: UserInteraction): Promise<void> {
    try {
      await db.insert(aiUserInteractions).values({
        userId: interaction.userId,
        alertId: interaction.alertId,
        sport: interaction.sport,
        alertType: interaction.alertType,
        aiEnhanced: interaction.aiEnhanced,
        userRating: interaction.userRating,
        userAction: interaction.userAction,
        timeOnAlert: interaction.timeOnAlert,
        followedRecommendation: interaction.followedRecommendation
      });
      
      // Update pattern success rates based on user feedback
      if (interaction.userRating && interaction.userRating >= 4) {
        await this.updatePatternSuccessRate(interaction.sport, interaction.alertType, true);
      } else if (interaction.userRating && interaction.userRating <= 2) {
        await this.updatePatternSuccessRate(interaction.sport, interaction.alertType, false);
      }
      
      console.log(`👤 AI Learning: Recorded user interaction for ${interaction.sport} ${interaction.alertType}`);
    } catch (error) {
      console.error('❌ AI Learning: Failed to record user interaction:', error);
    }
  }

  // Update pattern success rates based on outcomes
  private async updatePatternSuccessRate(sport: string, alertType: string, success: boolean): Promise<void> {
    try {
      const patterns = await db
        .select()
        .from(aiLearningPatterns)
        .where(and(
          eq(aiLearningPatterns.sport, sport),
          eq(aiLearningPatterns.alertType, alertType)
        ));

      for (const pattern of patterns) {
        const currentTimes = pattern.timesUsed || 0;
        const currentSuccessRate = parseFloat(pattern.successRate || '0.5');
        const newTimes = currentTimes + 1;
        
        // Calculate new success rate using moving average
        const newSuccessRate = success 
          ? (currentSuccessRate * currentTimes + 1) / newTimes
          : (currentSuccessRate * currentTimes) / newTimes;

        await db
          .update(aiLearningPatterns)
          .set({
            timesUsed: newTimes,
            successRate: newSuccessRate.toFixed(3),
            updatedAt: new Date()
          })
          .where(eq(aiLearningPatterns.id, pattern.id));
      }
    } catch (error) {
      console.error('❌ AI Learning: Failed to update pattern success rate:', error);
    }
  }

  // Get model performance metrics for analysis
  async getModelPerformanceMetrics(sport?: string): Promise<any[]> {
    try {
      const query = db.select().from(aiModelPerformance);
      
      const metrics = sport 
        ? await query.where(eq(aiModelPerformance.sport, sport))
        : await query;

      return metrics.map(m => ({
        sport: m.sport,
        alertType: m.alertType,
        modelVersion: m.modelVersion,
        avgProcessingTime: m.avgProcessingTime,
        accuracyScore: parseFloat(m.accuracyScore || '0'),
        userSatisfactionScore: parseFloat(m.userSatisfactionScore || '0'),
        totalEnhancements: m.totalEnhancements,
        successfulEnhancements: m.successfulEnhancements,
        successRate: m.totalEnhancements > 0 
          ? (m.successfulEnhancements / m.totalEnhancements) 
          : 0
      }));
    } catch (error) {
      console.error('❌ AI Learning: Failed to get model performance:', error);
      return [];
    }
  }

  // Get learning analytics for admin dashboard
  async getLearningAnalytics(): Promise<any> {
    try {
      const [patternCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiLearningPatterns);

      const [insightCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiCrossSportInsights);

      const [interactionCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiUserInteractions);

      const topPatterns = await db
        .select({
          sport: aiLearningPatterns.sport,
          alertType: aiLearningPatterns.alertType,
          successRate: aiLearningPatterns.successRate,
          timesUsed: aiLearningPatterns.timesUsed
        })
        .from(aiLearningPatterns)
        .orderBy(desc(aiLearningPatterns.successRate))
        .limit(10);

      return {
        totalPatterns: patternCount.count,
        totalInsights: insightCount.count,
        totalInteractions: interactionCount.count,
        topPerformingPatterns: topPatterns.map(p => ({
          ...p,
          successRate: parseFloat(p.successRate || '0')
        })),
        learningVelocity: {
          patternsPerDay: await this.calculateDailyLearningRate(),
          crossSportConnections: insightCount.count
        }
      };
    } catch (error) {
      console.error('❌ AI Learning: Failed to get learning analytics:', error);
      return {
        totalPatterns: 0,
        totalInsights: 0,
        totalInteractions: 0,
        topPerformingPatterns: [],
        learningVelocity: { patternsPerDay: 0, crossSportConnections: 0 }
      };
    }
  }

  private async calculateDailyLearningRate(): Promise<number> {
    try {
      const [result] = await db
        .select({ 
          count: sql<number>`count(*)`,
          daysSince: sql<number>`extract(day from now() - min(created_at))`
        })
        .from(aiLearningPatterns);

      return result.daysSince > 0 ? result.count / result.daysSince : 0;
    } catch (error) {
      return 0;
    }
  }

  // Clear old learning data (for maintenance)
  async cleanupOldLearningData(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await db
        .delete(aiLearningPatterns)
        .where(sql`created_at < ${cutoffDate}`);

      await db
        .delete(aiUserInteractions)
        .where(sql`created_at < ${cutoffDate}`);

      console.log(`🧹 AI Learning: Cleaned up learning data older than ${daysToKeep} days`);
    } catch (error) {
      console.error('❌ AI Learning: Failed to cleanup old data:', error);
    }
  }
}

export const aiLearningService = new AILearningService();
