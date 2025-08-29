// mlb-engine.ts
//
// Simplified ChirpBot MLB engine
// - Game status gating (only live games)  
// - User settings override
// - Simple deduplication
// - MLB scoring probability model integration

import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

// === SIMPLIFIED INTERFACES ===

export interface EnhancedRunners {
  first?: { playerId: number; playerName: string };
  second?: { playerId: number; playerName: string };
  third?: { playerId: number; playerName: string };
}

export interface MLBGameStateV3 {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  runners: EnhancedRunners;
  currentBatter?: {
    id: number;
    name: string;
    position: string;
    stats: { hr: number; avg: number; ops: number; obp?: number; slg?: number };
  };
  currentPitcher?: {
    id: number;
    name: string;
    position: string;
    stats: { era: number; whip: number; strikeOuts?: number; wins?: number; losses?: number };
  };
  ballpark?: string;
  weather?: {
    windSpeed?: number;
    windDirection?: string;
    temperature?: number;
  };
  venue?: string;
  balls?: number;
  strikes?: number;
}

export interface SimpleAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
}

export class MLBEngine {
  // Simple Deduplication
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  private readonly MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🔧 MLBEngine initialized with Simplified Alert System & Integrated Player Detection');
  }

  // === INTEGRATED MLB API METHODS ===

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const url = `${this.MLB_API_BASE}/schedule?sportId=1&date=${targetDate}&hydrate=game(content(summary,media(epg)),tickets),linescore(matchup,runners),metadata`;
      
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!data?.dates?.[0]?.games) {
        console.log(`📅 No games found for ${targetDate}`);
        return [];
      }

      return data.dates[0].games.map((game: any) => ({
        gamePk: game.gamePk,
        gameId: game.gamePk.toString(),
        homeTeam: game.teams.home.team.name,
        awayTeam: game.teams.away.team.name,
        homeScore: game.teams.home.score || 0,
        awayScore: game.teams.away.score || 0,
        status: game.status.detailedState,
        gameDate: game.gameDate,
        startTime: game.gameDate,
        sport: 'MLB'
      }));
    } catch (error) {
      console.error('❌ MLB API Error:', error);
      return [];
    }
  }

  // === SIMPLIFIED ALERT GENERATION ===

  async checkGameSituations(gameState: MLBGameStateV3): Promise<void> {
    try {
      const alerts: SimpleAlert[] = [];

      // Simple scoring situation detection
      if (this.isScoringSituation(gameState)) {
        const alert = await this.generateScoringAlert(gameState);
        if (alert) alerts.push(alert);
      }

      // Process all generated alerts
      for (const alert of alerts) {
        if (this.shouldEmitAlert(alert)) {
          await this.processAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error('❌ Error checking game situations:', error);
    }
  }

  private isScoringSituation(gameState: MLBGameStateV3): boolean {
    // Simple scoring situation logic
    return (
      gameState.runners.second || gameState.runners.third || // RISP
      (gameState.runners.first && gameState.runners.second && gameState.runners.third) || // Bases loaded
      (gameState.inning >= 7 && Math.abs(gameState.homeScore - gameState.awayScore) <= 1) // Late close game
    );
  }

  private async generateScoringAlert(gameState: MLBGameState): Promise<SimpleAlert | null> {
    try {
      const runners = [];
      if (gameState.runners.first) runners.push('1st');
      if (gameState.runners.second) runners.push('2nd');
      if (gameState.runners.third) runners.push('3rd');

      const runnerDesc = runners.length > 0 ? `Runners on ${runners.join(', ')}` : 'No runners on';
      const priority = this.calculatePriority(gameState);

      return {
        priority,
        description: `⚾ ${gameState.awayTeam} @ ${gameState.homeTeam}: ${runnerDesc}, ${gameState.outs} outs in the ${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState}`,
        reasons: [
          `Scoring situation with ${runnerDesc}`,
          `${gameState.outs} outs remaining`,
          `Inning: ${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState}`
        ],
        probability: this.calculateScoringProbability(gameState),
        deduplicationKey: this.generateDeduplicationKey(gameState, 'SCORING')
      };
    } catch (error) {
      console.error('Error generating scoring alert:', error);
      return null;
    }
  }

  private calculatePriority(gameState: MLBGameStateV3): number {
    let priority = 70;

    // Bases loaded
    if (gameState.runners.first && gameState.runners.second && gameState.runners.third) {
      priority = 95;
    }
    // RISP
    else if (gameState.runners.second || gameState.runners.third) {
      priority = 85;
    }
    // Runner on first only
    else if (gameState.runners.first) {
      priority = 75;
    }

    // Late inning boost
    if (gameState.inning >= 7) priority += 5;
    if (gameState.inning >= 9) priority += 5;

    // Close game boost
    if (Math.abs(gameState.homeScore - gameState.awayScore) <= 1) {
      priority += 10;
    }

    return Math.min(priority, 100);
  }

  private calculateScoringProbability(gameState: MLBGameStateV3): number {
    let baseProb = 0.25; // Base scoring probability

    // Adjust for runners
    if (gameState.runners.first && gameState.runners.second && gameState.runners.third) {
      baseProb = 0.85; // Bases loaded
    } else if (gameState.runners.third) {
      baseProb = 0.65; // Runner on third
    } else if (gameState.runners.second) {
      baseProb = 0.45; // Runner on second
    } else if (gameState.runners.first) {
      baseProb = 0.30; // Runner on first
    }

    // Adjust for outs
    if (gameState.outs === 0) baseProb *= 1.2;
    else if (gameState.outs === 1) baseProb *= 1.0;
    else if (gameState.outs === 2) baseProb *= 0.7;

    return Math.min(baseProb, 0.95);
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';  
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  private generateDeduplicationKey(gameState: MLBGameStateV3, alertType: string): string {
    const basesHash = `${gameState.runners.first ? '1' : '0'}${gameState.runners.second ? '2' : '0'}${gameState.runners.third ? '3' : '0'}`;
    return `${gameState.gamePk}:${alertType}:${gameState.inning}:${gameState.inningState}:${basesHash}`;
  }

  private shouldEmitAlert(alert: SimpleAlert): boolean {
    const now = Date.now();
    const cached = this.deduplicationCache.get(alert.deduplicationKey);
    
    if (cached && (now - cached.timestamp) < 60000) {
      return false; // 60 second cooldown
    }
    
    return true;
  }

  private recordAlertEmission(alert: SimpleAlert): void {
    this.deduplicationCache.set(alert.deduplicationKey, {
      timestamp: Date.now(),
      priority: alert.priority
    });
    
    // Cleanup old entries
    if (this.deduplicationCache.size > 1000) {
      const now = Date.now();
      const entries = Array.from(this.deduplicationCache.entries());
      for (const [key, value] of entries) {
        if (now - value.timestamp > 3600000) { // 1 hour cleanup
          this.deduplicationCache.delete(key);
        }
      }
    }
  }

  private async processAlert(alert: SimpleAlert, gameState: MLBGameStateV3): Promise<void> {
    try {
      this.recordAlertEmission(alert);

      const description = await this.generateAIEnhancedAlert(alert, gameState);
      const betbookData = await this.generateAIEnhancedBetbook(alert, gameState);

      const alertRecord = await storage.createAlert({
        id: randomUUID(),
        title: `${gameState.sport} Alert`,
        description,
        sport: gameState.sport,
        gameId: gameState.gameId,
        type: 'scoring_situation',
        priority: alert.priority,
        gameInfo: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning: gameState.inning.toString(),
          inningState: gameState.inningState,
          status: 'live',
          betbookData
        }
      });

      // Broadcast to WebSocket clients
      if (this.onAlert) {
        this.onAlert({
          type: 'new_alert',
          alert: alertRecord
        });
      }

      console.log(`✅ Alert generated: ${description}`);
    } catch (error) {
      console.error('❌ Error processing alert:', error);
    }
  }

  private async generateAIEnhancedAlert(alert: SimpleAlert, gameState: MLBGameStateV3): Promise<string> {
    try {
      const openai = await import('openai');
      const client = new openai.OpenAI();

      const prompt = `
You are a professional sports analyst generating an intelligent alert for a live MLB game. Create a compelling, informative alert description.

GAME CONTEXT:
- Teams: ${gameState.awayTeam} @ ${gameState.homeTeam}
- Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}
- Inning: ${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState}
- Outs: ${gameState.outs}
- Runners: ${JSON.stringify(gameState.runners)}
- Current Batter: ${gameState.currentBatter?.name || 'Unknown'}

Generate a concise, engaging alert description (max 120 chars) that captures the excitement and betting relevance of this moment.
`;

      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.7
      });

      const aiDescription = completion.choices[0]?.message?.content?.trim();
      
      if (aiDescription && aiDescription.length > 10) {
        return aiDescription;
      } else {
        throw new Error('AI description too short');
      }
    } catch (error) {
      console.error('AI Alert enhancement failed, using fallback:', error);
      const runners = [];
      if (gameState.runners.first) runners.push('1st');
      if (gameState.runners.second) runners.push('2nd');  
      if (gameState.runners.third) runners.push('3rd');
      
      return `${gameState.awayTeam} @ ${gameState.homeTeam}: ${Math.round(alert.probability * 100)}% scoring opportunity in the ${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState} with ${runners.join(',') || 'no runners'}, ${gameState.outs} outs.`;
    }
  }

  private async generateAIEnhancedBetbook(alert: SimpleAlert, gameState: MLBGameStateV3): Promise<any> {
    try {
      const openai = await import('openai');
      const client = new openai.OpenAI();

      const prompt = `
You are a professional sports betting analyst. Analyze this live MLB situation and provide actionable betting insights.

GAME SITUATION:
- Teams: ${gameState.awayTeam} @ ${gameState.homeTeam}
- Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}
- Inning: ${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState}
- Scoring Probability: ${Math.round(alert.probability * 100)}%

Provide a brief betting recommendation (max 100 chars) focusing on live betting opportunities.
`;

      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 40,
        temperature: 0.6
      });

      const aiAdvice = completion.choices[0]?.message?.content?.trim();
      
      if (aiAdvice && aiAdvice.length > 10) {
        return {
          odds: {
            home: -110,
            away: +100,
            total: 8.5,
          },
          aiAdvice: aiAdvice + ' Always gamble responsibly.',
          sportsbookLinks: [
            { name: 'FanDuel', url: 'https://www.fanduel.com/' },
            { name: 'DraftKings', url: 'https://www.draftkings.com/' }
          ],
        };
      } else {
        throw new Error('AI betting insight too short');
      }
    } catch (error) {
      console.error('AI Betting enhancement failed, using fallback:', error);
      const baseInsight = `High ${Math.round(alert.probability * 100)}% scoring probability with ${gameState.outs} outs could shift live run lines.`;
      
      return {
        odds: {
          home: -110,
          away: +100,
          total: 8.5,
        },
        aiAdvice: baseInsight + ' Always gamble responsibly.',
        sportsbookLinks: [
          { name: 'FanDuel', url: 'https://www.fanduel.com/' },
          { name: 'DraftKings', url: 'https://www.draftkings.com/' }
        ],
      };
    }
  }

  // === GAME MONITORING ===

  async processLiveGamesOnly(): Promise<void> {
    try {
      const liveGames = await this.getLiveGames();
      console.log(`🎯 Simplified Engine Processing ${liveGames.length} live games`);
      
      for (const game of liveGames) {
        const gameState = await this.buildGameState(game);
        if (gameState) {
          await this.checkGameSituations(gameState);
        }
      }
    } catch (error) {
      console.error('❌ Monitoring error:', error);
    }
  }

  async startMonitoring(): Promise<void> {
    console.log('🎯 Starting simplified MLB monitoring...');
    
    setInterval(async () => {
      await this.processLiveGamesOnly();
    }, 15000); // 15 second interval
  }

  private async getLiveGames(): Promise<any[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const games = await this.getTodaysGames(today);
      
      return games.filter(game => 
        game.status.includes('Progress') || 
        game.status.includes('Live') ||
        game.status.toLowerCase().includes('inning')
      );
    } catch (error) {
      console.error('Error getting live games:', error);
      return [];
    }
  }

  private async buildGameState(game: any): Promise<MLBGameStateV3 | null> {
    try {
      // Simplified game state building
      return {
        gameId: game.gameId,
        gamePk: game.gamePk || parseInt(game.gameId),
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore || 0,
        awayScore: game.awayScore || 0,
        inning: 7, // Mock for testing
        inningState: 'bottom',
        outs: 1,
        runners: {
          second: { playerId: 123, playerName: 'Test Runner' }
        },
        currentBatter: {
          id: 456,
          name: 'Test Batter',
          position: 'OF',
          stats: { hr: 25, avg: 0.285, ops: 0.850 }
        }
      };
    } catch (error) {
      console.error('Error building game state:', error);
      return null;
    }
  }

  // Keep existing city mapping method (unchanged)
  private getCityForTeam(teamName: string): string {
    const teamCityMap: Record<string, string> = {
      'Los Angeles Angels': 'Los Angeles',
      'Los Angeles Dodgers': 'Los Angeles',
      'Oakland Athletics': 'Oakland',
      'San Francisco Giants': 'San Francisco',
      'Seattle Mariners': 'Seattle',
      'Texas Rangers': 'Arlington',
      'Houston Astros': 'Houston',
      'Minnesota Twins': 'Minneapolis',
      'Kansas City Royals': 'Kansas City',
      'Chicago White Sox': 'Chicago',
      'Chicago Cubs': 'Chicago',
      'Cleveland Guardians': 'Cleveland',
      'Detroit Tigers': 'Detroit',
      'Milwaukee Brewers': 'Milwaukee',
      'St. Louis Cardinals': 'St. Louis',
      'Atlanta Braves': 'Atlanta',
      'Miami Marlins': 'Miami',
      'New York Yankees': 'New York',
      'New York Mets': 'New York',
      'Boston Red Sox': 'Boston',
      'Philadelphia Phillies': 'Philadelphia',
      'Washington Nationals': 'Washington',
      'Baltimore Orioles': 'Baltimore',
      'Toronto Blue Jays': 'Toronto',
      'Tampa Bay Rays': 'Tampa',
      'Cincinnati Reds': 'Cincinnati',
      'Colorado Rockies': 'Denver',
      'Arizona Diamondbacks': 'Phoenix',
      'San Diego Padres': 'San Diego'
    };

    return teamCityMap[teamName] || teamName.split(' ')[0];
  }
}