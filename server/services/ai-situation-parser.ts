/**
 * AI Situation Parser Service
 * 
 * Uses OpenAI to extract game situation data (down, distance, field position)
 * from play-by-play text when ESPN's structured data is unavailable.
 */

import { openaiApiCircuit, protectedFetch } from '../middleware/circuit-breaker';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface ParsedSituation {
  down: number | null;
  yardsToGo: number | null;
  fieldPosition: number | null;
  possession: string | null;
  confidence: number; // 0-1 scale
  parsedFrom: 'ai' | 'structured';
}

export class AISituationParser {
  private static instance: AISituationParser;
  private parseCache = new Map<string, { data: ParsedSituation; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 second cache
  private apiKeyWarningShown = false;

  private constructor() {
    console.log('🤖 AI Situation Parser: Initialized');
  }

  static getInstance(): AISituationParser {
    if (!AISituationParser.instance) {
      AISituationParser.instance = new AISituationParser();
    }
    return AISituationParser.instance;
  }

  /**
   * Parse play-by-play text to extract situation data using OpenAI
   */
  async parseSituationFromText(
    playText: string,
    gameId: string,
    homeTeamAbbrev: string,
    awayTeamAbbrev: string
  ): Promise<ParsedSituation> {
    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      if (!this.apiKeyWarningShown) {
        console.warn('⚠️ AI Parser: OPENAI_API_KEY not configured, AI parsing disabled');
        this.apiKeyWarningShown = true;
      }
      return {
        down: null,
        yardsToGo: null,
        fieldPosition: null,
        possession: null,
        confidence: 0,
        parsedFrom: 'ai'
      };
    }
    
    // Check cache first
    const cacheKey = `${gameId}_${playText}`;
    const cached = this.parseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`💾 AI Parser: Using cached situation for ${gameId}`);
      return cached.data;
    }

    try {
      console.log(`🤖 AI Parser: Analyzing play text for game ${gameId}: "${playText.substring(0, 100)}..."`);

      const prompt = `Extract game situation data from this NFL play-by-play text.

Play: "${playText}"
Home Team: ${homeTeamAbbrev}
Away Team: ${awayTeamAbbrev}

Extract:
1. down (1-4, or null if not mentioned)
2. yardsToGo (yards needed for first down, or null)
3. fieldPosition (yard line 0-99, where 50 is midfield, or null)
4. possession (team abbreviation who has the ball: "${homeTeamAbbrev}" or "${awayTeamAbbrev}", or null)

Examples:
- "3rd and 7 at MIA 35" → down=3, yardsToGo=7, fieldPosition=35, possession=MIA
- "1st and 10 at NYJ 42" → down=1, yardsToGo=10, fieldPosition=42, possession=NYJ
- "2nd and goal at the 5" → down=2, yardsToGo=null, fieldPosition=5, possession=(team on offense)

Return ONLY a JSON object with these exact fields:
{
  "down": number or null,
  "yardsToGo": number or null,
  "fieldPosition": number or null,
  "possession": string or null,
  "confidence": number 0-1
}`;

      const response = await protectedFetch(
        openaiApiCircuit,
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an NFL data extraction expert. Extract structured game situation data from play-by-play text. Return only valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 150
          })
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      const result: ParsedSituation = {
        down: parsed.down !== undefined ? parsed.down : null,
        yardsToGo: parsed.yardsToGo !== undefined ? parsed.yardsToGo : null,
        fieldPosition: parsed.fieldPosition !== undefined ? parsed.fieldPosition : null,
        possession: parsed.possession || null,
        confidence: parsed.confidence || 0.8,
        parsedFrom: 'ai'
      };

      console.log(`✅ AI Parser: Extracted situation - down=${result.down}, yardsToGo=${result.yardsToGo}, fieldPosition=${result.fieldPosition}, confidence=${result.confidence}`);

      // Cache the result
      this.parseCache.set(cacheKey, { data: result, timestamp: Date.now() });

      // Clean up old cache entries
      this.cleanupCache();

      return result;
    } catch (error) {
      console.error('❌ AI Parser: Error parsing situation:', error);
      
      // Return null data on error
      return {
        down: null,
        yardsToGo: null,
        fieldPosition: null,
        possession: null,
        confidence: 0,
        parsedFrom: 'ai'
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.parseCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.parseCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.parseCache.clear();
    console.log('🧹 AI Parser: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.parseCache.size,
      ttl: this.CACHE_TTL
    };
  }
}

// Export singleton instance
export const aiSituationParser = AISituationParser.getInstance();
