import OpenAI from 'openai';
import { IStorage } from '../storage';

interface MLBGameContext {
  homeTeam: string;
  awayTeam: string;
  score: { home: number; away: number };
  inning?: number;
  inningState?: 'top' | 'bottom';
  outs?: number;
  balls?: number;
  strikes?: number;
  runners?: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  currentBatter?: any;
  currentPitcher?: any;
}

interface AIAlertDecision {
  shouldTrigger: boolean;
  priority: number;
  title: string;
  description: string;
  reasoning?: string;
}

export class MLBAISystem {
  private openai: OpenAI | null = null;
  private enabled: boolean = false;
  private customPrompt: string = '';
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    
    // Initialize OpenAI only if API key exists
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('🤖 MLB AI System initialized with OpenAI');
    } else {
      console.log('⚠️ MLB AI System: No OpenAI API key found');
    }
  }

  async updateSettings(enabled: boolean, customPrompt?: string) {
    this.enabled = enabled;
    if (customPrompt) {
      this.customPrompt = customPrompt;
    }
    console.log(`🤖 MLB AI System ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  async isEnabled(): Promise<boolean> {
    return this.enabled && !!this.openai;
  }

  async analyzeGameSituation(gameContext: MLBGameContext): Promise<AIAlertDecision | null> {
    if (!this.enabled || !this.openai) {
      return null;
    }

    try {
      // Base system prompt that teaches the AI about baseball
      const systemPrompt = `You are an expert baseball analyst AI that decides when to generate alerts for exciting game moments.
      
Baseball Context Rules:
- Innings: Games have 9 innings (top and bottom halves)
- Outs: 3 outs per half-inning
- Bases: First, Second, Third base can have runners
- Scoring: Runners crossing home plate score runs
- Key Situations:
  * Bases loaded = all 3 bases have runners (high scoring potential)
  * RISP = Runners in Scoring Position (2nd or 3rd base)
  * Close game = score difference ≤ 3 runs
  * Late innings = 7th inning or later

Alert Priority Guidelines:
- 90-100: Critical moments (bases loaded 2 outs, 9th inning tie game)
- 70-89: High importance (RISP late innings, close game situations)
- 50-69: Moderate importance (scoring opportunities, lead changes)
- 30-49: Low importance (routine plays, early innings)

${this.customPrompt ? `\nCustom Instructions:\n${this.customPrompt}` : ''}

Respond with a JSON object containing:
{
  "shouldTrigger": boolean,
  "priority": number (0-100),
  "title": "Brief alert title",
  "description": "Engaging description of why this moment matters",
  "reasoning": "Your analysis of the situation"
}`;

      const userPrompt = `Current Game Situation:
${gameContext.awayTeam} @ ${gameContext.homeTeam}
Score: ${gameContext.awayTeam} ${gameContext.score.away} - ${gameContext.homeTeam} ${gameContext.score.home}
Inning: ${gameContext.inning || 1} ${gameContext.inningState || 'top'}
Outs: ${gameContext.outs || 0}
Count: ${gameContext.balls || 0}-${gameContext.strikes || 0}
Runners: ${this.formatRunners(gameContext.runners)}
${gameContext.currentBatter ? `Batter: ${gameContext.currentBatter.name}` : ''}

Should an alert be triggered for this situation? Analyze the game state and provide your decision.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // Using the latest model as per blueprint
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.7,
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}') as AIAlertDecision;
      
      // Validate the response
      if (typeof decision.shouldTrigger !== 'boolean' || 
          typeof decision.priority !== 'number' ||
          !decision.title || !decision.description) {
        console.error('Invalid AI response format:', decision);
        return null;
      }

      // Only trigger if priority is above threshold
      if (decision.priority < 50) {
        decision.shouldTrigger = false;
      }

      console.log(`🤖 AI Decision: ${decision.shouldTrigger ? '✅ TRIGGER' : '❌ SKIP'} - Priority: ${decision.priority} - ${decision.title}`);
      
      return decision;

    } catch (error) {
      console.error('MLB AI System error:', error);
      return null;
    }
  }

  private formatRunners(runners?: { first: boolean; second: boolean; third: boolean }): string {
    if (!runners) return 'None';
    
    const occupied = [];
    if (runners.first) occupied.push('1st');
    if (runners.second) occupied.push('2nd');
    if (runners.third) occupied.push('3rd');
    
    if (occupied.length === 0) return 'None';
    if (occupied.length === 3) return 'BASES LOADED';
    return occupied.join(', ');
  }

  async testAILogic(): Promise<void> {
    console.log('🧪 Testing MLB AI System...');
    
    // Test scenario: Bases loaded, 2 outs, tie game, 9th inning
    const testContext: MLBGameContext = {
      homeTeam: 'Yankees',
      awayTeam: 'Red Sox',
      score: { home: 5, away: 5 },
      inning: 9,
      inningState: 'bottom',
      outs: 2,
      balls: 3,
      strikes: 2,
      runners: {
        first: true,
        second: true,
        third: true
      }
    };

    const decision = await this.analyzeGameSituation(testContext);
    
    if (decision) {
      console.log('✅ AI Test Result:', {
        trigger: decision.shouldTrigger,
        priority: decision.priority,
        title: decision.title,
        description: decision.description,
        reasoning: decision.reasoning
      });
    } else {
      console.log('❌ AI Test Failed - No decision returned');
    }
  }
}

// Singleton instance
let mlbAISystemInstance: MLBAISystem | null = null;

export function getMLBAISystem(storage: IStorage): MLBAISystem {
  if (!mlbAISystemInstance) {
    mlbAISystemInstance = new MLBAISystem(storage);
  }
  return mlbAISystemInstance;
}