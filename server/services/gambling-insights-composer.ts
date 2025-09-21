import type { AlertResult, GamblingInsights } from '../../shared/schema';
import { oddsApiService, type ProcessedOdds } from './odds-api-service';

// Weather interface to match existing system
interface WeatherData {
  windSpeed?: number;
  windDirection?: string;
  temperature?: number;
  conditions?: string;
  severity?: 'low' | 'medium' | 'high';
}

// Game state interface matching existing patterns
interface GameStateData {
  sport: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  isLive: boolean;
  // MLB specific
  inning?: number;
  isTopInning?: boolean;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  outs?: number;
  balls?: number;
  strikes?: number;
  currentBatter?: string;
  onDeckBatter?: string;
  currentPitcher?: string;
  pitchCount?: number;
  // NFL/NCAAF specific
  quarter?: number;
  down?: number;
  yardsToGo?: number;
  fieldPosition?: number;
  timeRemaining?: string;
  possession?: string;
  redZoneEfficiency?: number;
  turnovers?: { home: number; away: number; differential: number };
  // NBA/WNBA specific
  fouls?: { home: number; away: number };
  timeouts?: { home: number; away: number };
  shotClock?: number;
  recentScoring?: { home: number; away: number; timeframe: string };
  starPlayers?: { name: string; position: string; performance: string }[];
  // CFL specific (inherits from NFL but has unique rules)
  // Weather context from existing system
  weatherContext?: WeatherData;
  [key: string]: any; // Allow additional sport-specific fields
}

// Abstract base class for sport-specific mappers
abstract class BaseSportMapper {
  abstract sport: string;
  abstract generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string[]>;
  abstract generateStructuredTemplate(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string>;
  abstract calculateConfidence(alert: AlertResult, gameState: GameStateData): number;
  abstract generateTags(alert: AlertResult, gameState: GameStateData): string[];

  // Helper method to format bullet points (15-25 words)
  protected formatBulletPoint(text: string): string {
    const words = text.split(' ');
    if (words.length > 25) {
      return words.slice(0, 25).join(' ') + '...';
    }
    if (words.length < 15) {
      // Add contextual filler if too short
      return text;
    }
    return text;
  }

  // Helper to parse time remaining in seconds
  protected parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    
    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      return 0;
    }
  }
}

// MLB Insights Mapper
class MLBInsightsMapper extends BaseSportMapper {
  sport = 'MLB';

  async generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string[]> {
    const bullets: string[] = [];

    // On-deck batter analysis
    if (gameState.onDeckBatter && gameState.currentBatter) {
      const onDeckAnalysis = this.analyzeOnDeckBatter(gameState);
      bullets.push(this.formatBulletPoint(onDeckAnalysis));
    }

    // Wind impact on scoring
    if (weather?.windSpeed || gameState.weatherContext?.windSpeed) {
      const weatherData = weather || gameState.weatherContext;
      if (weatherData) {
        const windImpact = this.analyzeWindImpact(weatherData);
        if (windImpact) bullets.push(this.formatBulletPoint(windImpact));
      }
    }

    // RE24 scoring probability
    if (gameState.hasFirst !== undefined || gameState.hasSecond !== undefined || gameState.hasThird !== undefined) {
      const re24Analysis = this.calculateRE24Probability(gameState);
      bullets.push(this.formatBulletPoint(re24Analysis));
    }

    // Pitcher fatigue/pitch count
    if (gameState.pitchCount && gameState.currentPitcher) {
      const pitcherAnalysis = this.analyzePitcherFatigue(gameState);
      if (pitcherAnalysis) bullets.push(this.formatBulletPoint(pitcherAnalysis));
    }

    // Base running threats
    if (gameState.hasFirst || gameState.hasSecond) {
      const baserunningThreat = this.analyzeBaserunningThreats(gameState);
      bullets.push(this.formatBulletPoint(baserunningThreat));
    }

    // Add market data bullets if odds available
    if (oddsData && oddsData.dataQuality !== 'poor') {
      const marketBullets = this.generateMarketDataBullets(oddsData, gameState);
      bullets.push(...marketBullets);
    }

    return bullets.slice(0, 5); // Max 5 bullets
  }

  async generateStructuredTemplate(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string> {
    // Generate alert header
    const alertType = (alert.type || 'MLB').toUpperCase().replace(/_/g, ' ');
    
    // Generate key information line with scoring probability
    const scoringProb = this.calculateScoringProbability(gameState);
    const outs = gameState.outs || 0;
    const keyLine = `💎 ${this.getBaseStateDescription(gameState.hasFirst || false, gameState.hasSecond || false, gameState.hasThird || false)} (${scoringProb}% scoring chance) ${gameState.awayTeam} vs ${gameState.homeTeam} - ${outs} out${outs !== 1 ? 's' : ''}`;
    
    // Generate game situation
    const inningStr = gameState.inning ? `${gameState.isTopInning ? 'Top' : 'Bot'} ${gameState.inning}` : 'Live';
    const countStr = (gameState.balls !== undefined && gameState.strikes !== undefined) ? `${gameState.balls}-${gameState.strikes} count` : '';
    const runnersStr = this.formatRunners(gameState.hasFirst || false, gameState.hasSecond || false, gameState.hasThird || false);
    
    let situationSection = `🎮 GAME SITUATION\n${gameState.awayTeam} ${gameState.awayScore} @ ${gameState.homeTeam} ${gameState.homeScore}\n📍 ${inningStr} • ${outs} out${outs !== 1 ? 's' : ''}`;
    
    if (countStr) {
      situationSection += ` • ${countStr}`;
    }
    
    if (runnersStr) {
      situationSection += `\n🏃 ${runnersStr}`;
    }
    
    // Add weather or pitcher info if available
    if (weather?.windSpeed && weather.windSpeed > 10) {
      situationSection += `\n🌬️ ${weather.windSpeed}mph winds affecting play`;
    } else if (gameState.pitchCount && gameState.pitchCount > 90) {
      situationSection += `\n⚡ Pitcher: ${gameState.pitchCount} pitches (fatigue zone)`;
    }
    
    return `${alertType} Alert\n\n${keyLine}\n\n${situationSection}`;
  }

  // Helper methods for structured template
  private calculateScoringProbability(gameState: GameStateData): number {
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const hasThird = gameState.hasThird || false;
    const outs = gameState.outs || 0;

    // RE24 lookup table (simplified)
    const re24Map: Record<string, number> = {
      '000_0': 0.461, '000_1': 0.243, '000_2': 0.095,
      '100_0': 0.831, '100_1': 0.473, '100_2': 0.178,
      '010_0': 1.068, '010_1': 0.644, '010_2': 0.305,
      '001_0': 1.277, '001_1': 0.897, '001_2': 0.382,
      '110_0': 1.437, '110_1': 0.908, '110_2': 0.420,
      '101_0': 1.784, '101_1': 1.171, '101_2': 0.494,
      '011_0': 2.052, '011_1': 1.426, '011_2': 0.661,
      '111_0': 2.254, '111_1': 1.541, '111_2': 0.815
    };

    const baseState = `${hasThird ? '1' : '0'}${hasSecond ? '1' : '0'}${hasFirst ? '1' : '0'}_${outs}`;
    const re24Value = re24Map[baseState] || 0.5;
    return Math.round(re24Value * 100 / 2.254); // Normalize to percentage
  }

  private formatRunners(hasFirst: boolean, hasSecond: boolean, hasThird: boolean): string {
    const bases = [];
    if (hasFirst) bases.push('1st');
    if (hasSecond) bases.push('2nd');
    if (hasThird) bases.push('3rd');
    
    if (bases.length === 0) return '';
    if (bases.length === 3) return 'Runners: bases loaded';
    return `Runners: ${bases.join(', ')}`;
  }

  // Generate market data bullets for MLB
  private generateMarketDataBullets(oddsData: ProcessedOdds, gameState: GameStateData): string[] {
    const bullets: string[] = [];

    // Moneyline analysis
    if (oddsData.markets.moneyline) {
      const { home, away, bookmaker } = oddsData.markets.moneyline;
      const homeTeam = oddsData.homeTeam;
      const awayTeam = oddsData.awayTeam;
      
      const homeOdds = home > 0 ? `+${home}` : `${home}`;
      const awayOdds = away > 0 ? `+${away}` : `${away}`;
      
      bullets.push(this.formatBulletPoint(
        `${bookmaker} moneyline: ${homeTeam} ${homeOdds}, ${awayTeam} ${awayOdds} - reflects current market sentiment on game outcome`
      ));
    }

    // Spread analysis  
    if (oddsData.markets.spread) {
      const { points, home, away, bookmaker } = oddsData.markets.spread;
      const homeTeam = oddsData.homeTeam;
      
      const spreadText = points > 0 ? `+${points}` : `${points}`;
      bullets.push(this.formatBulletPoint(
        `${bookmaker} spread: ${homeTeam} ${spreadText} at ${home} odds - current scoring situation may impact spread value`
      ));
    }

    // Over/under analysis
    if (oddsData.markets.total) {
      const { points, over, under, bookmaker } = oddsData.markets.total;
      
      bullets.push(this.formatBulletPoint(
        `${bookmaker} total: ${points} runs (Over ${over}, Under ${under}) - scoring opportunity directly affects over/under potential`
      ));
    }

    return bullets;
  }

  private analyzeOnDeckBatter(gameState: GameStateData): string {
    const currentBatter = gameState.currentBatter || 'Current batter';
    const onDeckBatter = gameState.onDeckBatter || 'On-deck batter';
    const outs = gameState.outs || 0;
    
    return `${currentBatter} batting with ${onDeckBatter} on deck - ${outs} out${outs !== 1 ? 's' : ''} creates pressure for immediate production`;
  }

  private analyzeWindImpact(weather: WeatherData): string | null {
    const windSpeed = weather.windSpeed || 0;
    const windDirection = weather.windDirection || '';
    
    if (windSpeed < 10) return null;
    
    // First check for legacy out/in/center patterns
    if (windDirection.includes('out') || windDirection.includes('center')) {
      return `${windSpeed}mph wind blowing out to center field significantly increases home run probability for power hitters`;
    } else if (windDirection.includes('in')) {
      return `${windSpeed}mph wind blowing in from outfield reduces home run chances and favors contact hitters`;
    }
    
    // Enhanced cardinal direction mapping
    const cardinalImpact = this.mapCardinalDirectionToImpact(windDirection.toUpperCase(), windSpeed);
    if (cardinalImpact) return cardinalImpact;
    
    return `${windSpeed}mph crosswind affects ball trajectory and may influence batter approach at the plate`;
  }

  private mapCardinalDirectionToImpact(direction: string, windSpeed: number): string | null {
    // Cardinal direction to stadium impact mapping
    const cardinalMap: Record<string, { impact: string; description: string }> = {
      'N': { impact: 'neutral', description: 'north wind creates variable effects depending on ballpark orientation' },
      'NE': { impact: 'slight_in', description: 'northeast wind typically reduces carry to right-center field' },
      'E': { impact: 'cross', description: 'east wind creates significant crosswind affecting right field trajectory' },
      'SE': { impact: 'slight_out', description: 'southeast wind may assist balls hit to left-center field' },
      'S': { impact: 'variable', description: 'south wind impact varies greatly by ballpark orientation and layout' },
      'SW': { impact: 'out', description: 'southwest wind commonly favors home runs to right field' },
      'W': { impact: 'cross', description: 'west wind creates crosswind conditions affecting left field carries' },
      'NW': { impact: 'in', description: 'northwest wind typically reduces home run probability to all fields' }
    };

    for (const [cardinal, config] of Object.entries(cardinalMap)) {
      if (direction.includes(cardinal)) {
        switch (config.impact) {
          case 'out':
            return `${windSpeed}mph ${cardinal.toLowerCase()} wind ${config.description} - increases power hitting opportunities significantly`;
          case 'in':
            return `${windSpeed}mph ${cardinal.toLowerCase()} wind ${config.description} - favors contact over power approach`;
          case 'cross':
            return `${windSpeed}mph ${cardinal.toLowerCase()} wind ${config.description} - affects timing and ball flight`;
          case 'slight_out':
            return `${windSpeed}mph ${cardinal.toLowerCase()} wind ${config.description} - slight advantage for power hitters`;
          case 'slight_in':
            return `${windSpeed}mph ${cardinal.toLowerCase()} wind ${config.description} - slight disadvantage for power hitting`;
          default:
            return `${windSpeed}mph ${cardinal.toLowerCase()} wind ${config.description} - monitor for developing patterns`;
        }
      }
    }

    return null;
  }

  private calculateRE24Probability(gameState: GameStateData): string {
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const hasThird = gameState.hasThird || false;
    const outs = gameState.outs || 0;

    // RE24 lookup table (simplified)
    const re24Map: Record<string, number> = {
      '000_0': 0.461, '000_1': 0.243, '000_2': 0.095,
      '100_0': 0.831, '100_1': 0.473, '100_2': 0.178,
      '010_0': 1.068, '010_1': 0.644, '010_2': 0.305,
      '001_0': 1.277, '001_1': 0.897, '001_2': 0.382,
      '110_0': 1.437, '110_1': 0.908, '110_2': 0.420,
      '101_0': 1.784, '101_1': 1.171, '101_2': 0.494,
      '011_0': 2.052, '011_1': 1.426, '011_2': 0.661,
      '111_0': 2.254, '111_1': 1.541, '111_2': 0.815
    };

    const baseState = `${hasThird ? '1' : '0'}${hasSecond ? '1' : '0'}${hasFirst ? '1' : '0'}_${outs}`;
    const re24Value = re24Map[baseState] || 0.5;
    const probability = Math.round(re24Value * 100 / 2.254); // Normalize to percentage

    const baseDescription = this.getBaseStateDescription(hasFirst, hasSecond, hasThird);
    return `Current base state (${baseDescription}) shows ${probability}% expected run probability based on historical RE24 analysis`;
  }

  private getBaseStateDescription(hasFirst: boolean, hasSecond: boolean, hasThird: boolean): string {
    const bases = [];
    if (hasFirst) bases.push('1st');
    if (hasSecond) bases.push('2nd');
    if (hasThird) bases.push('3rd');
    
    if (bases.length === 0) return 'bases empty';
    if (bases.length === 3) return 'bases loaded';
    return `runner${bases.length > 1 ? 's' : ''} on ${bases.join(' and ')}`;
  }

  private analyzePitcherFatigue(gameState: GameStateData): string | null {
    const pitchCount = gameState.pitchCount || 0;
    const pitcher = gameState.currentPitcher || 'Starting pitcher';
    const inning = gameState.inning || 1;

    if (pitchCount < 80) return null;

    if (pitchCount > 100) {
      return `${pitcher} at ${pitchCount} pitches in ${inning}th inning showing fatigue signs - batter advantage increases significantly`;
    } else if (pitchCount > 90) {
      return `${pitcher} approaching fatigue threshold at ${pitchCount} pitches - command and velocity likely declining slightly`;
    }

    return `${pitcher} at ${pitchCount} pitches entering potential fatigue zone where hitter success rates typically increase`;
  }

  private analyzeBaserunningThreats(gameState: GameStateData): string {
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const outs = gameState.outs || 0;

    if (hasSecond) {
      return `Runner in scoring position threatens on any contact - single likely scores run with ${outs} out${outs !== 1 ? 's' : ''}`;
    } else if (hasFirst) {
      return `Runner on first creates steal threat and hit-and-run opportunity - doubles gap coverage for ground balls`;
    }

    return 'No immediate baserunning threats but situation can change quickly with any baserunner';
  }

  calculateConfidence(alert: AlertResult, gameState: GameStateData): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on available data
    if (gameState.currentBatter) confidence += 0.1;
    if (gameState.onDeckBatter) confidence += 0.1;
    if (gameState.pitchCount) confidence += 0.1;
    if (gameState.weatherContext?.windSpeed) confidence += 0.1;
    if (gameState.hasFirst !== undefined) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  generateTags(alert: AlertResult, gameState: GameStateData): string[] {
    const tags: string[] = ['mlb'];

    if (gameState.hasFirst || gameState.hasSecond || gameState.hasThird) {
      tags.push('scoring-opportunity');
    }
    if (gameState.weatherContext?.windSpeed && gameState.weatherContext.windSpeed > 10) {
      tags.push('weather-impact');
    }
    if (gameState.pitchCount && gameState.pitchCount > 90) {
      tags.push('pitcher-fatigue');
    }
    if (gameState.outs === 2) {
      tags.push('high-pressure');
    }

    return tags;
  }
}

// NFL/NCAAF Insights Mapper
class NFLNCAAFInsightsMapper extends BaseSportMapper {
  sport = 'NFL'; // Handles both NFL and NCAAF

  async generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string[]> {
    const bullets: string[] = [];

    // Down-distance situation
    if (gameState.down !== undefined && gameState.yardsToGo !== undefined) {
      const downDistanceAnalysis = this.analyzeDownDistance(gameState);
      bullets.push(this.formatBulletPoint(downDistanceAnalysis));
    }

    // Field position advantage
    if (gameState.fieldPosition !== undefined) {
      const fieldPositionAnalysis = this.analyzeFieldPosition(gameState);
      bullets.push(this.formatBulletPoint(fieldPositionAnalysis));
    }

    // Red zone efficiency
    if (gameState.fieldPosition !== undefined && gameState.fieldPosition <= 20) {
      const redZoneAnalysis = this.analyzeRedZoneEfficiency(gameState);
      bullets.push(this.formatBulletPoint(redZoneAnalysis));
    }

    // Turnover differential
    if (gameState.turnovers) {
      const turnoverAnalysis = this.analyzeTurnoverDifferential(gameState);
      if (turnoverAnalysis) bullets.push(this.formatBulletPoint(turnoverAnalysis));
    }

    // Weather impact on passing/kicking
    if (weather?.windSpeed || gameState.weatherContext?.windSpeed) {
      const weatherData = weather || gameState.weatherContext;
      if (weatherData) {
        const weatherImpact = this.analyzeWeatherImpact(weatherData, gameState);
        if (weatherImpact) bullets.push(this.formatBulletPoint(weatherImpact));
      }
    }

    return bullets.slice(0, 5);
  }

  async generateStructuredTemplate(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string> {
    // Generate alert header
    const alertType = (alert.type || 'FOOTBALL').toUpperCase().replace(/_/g, ' ');
    
    // Generate key information line with TD probability
    const tdProb = this.calculateTouchdownProbability(gameState);
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;
    const possession = gameState.possession || 'Team';
    const keyLine = `💎 ${this.getOrdinal(down)} & ${yardsToGo} (${tdProb}% TD chance) ${gameState.awayTeam} vs ${gameState.homeTeam} - ${possession} ball`;
    
    // Generate game situation
    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || 'Live';
    const fieldPos = gameState.fieldPosition !== undefined ? gameState.fieldPosition : 50;
    
    let situationSection = `🎮 GAME SITUATION\n${gameState.awayTeam} ${gameState.awayScore} @ ${gameState.homeTeam} ${gameState.homeScore}\n📍 Q${quarter} • ${timeRemaining} • ${this.getOrdinal(down)} & ${yardsToGo}\n🏟️ Field position: ${fieldPos}-yard line`;
    
    // Add context info
    if (fieldPos <= 20) {
      situationSection += `\n🎯 Red zone opportunity`;
    } else if (fieldPos >= 80) {
      situationSection += `\n⚠️ Deep in own territory`;
    }
    
    // Add weather if significant
    if (weather?.windSpeed && weather.windSpeed >= 15) {
      situationSection += `\n🌬️ ${weather.windSpeed}mph winds affecting throws/kicks`;
    }
    
    return `${alertType} Alert\n\n${keyLine}\n\n${situationSection}`;
  }

  private calculateTouchdownProbability(gameState: GameStateData): number {
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;
    const fieldPosition = gameState.fieldPosition || 50;
    
    let baseProbability = 50; // Base probability
    
    // Adjust for field position
    if (fieldPosition <= 10) baseProbability = 75;
    else if (fieldPosition <= 20) baseProbability = 65;
    else if (fieldPosition <= 35) baseProbability = 55;
    else if (fieldPosition >= 80) baseProbability = 20;
    
    // Adjust for down
    if (down === 1) baseProbability += 10;
    else if (down === 4) baseProbability += 15; // High stakes
    else if (down === 3) baseProbability -= 5;
    
    // Adjust for distance
    if (yardsToGo <= 3) baseProbability += 10;
    else if (yardsToGo >= 8) baseProbability -= 10;
    
    return Math.min(Math.max(baseProbability, 15), 85);
  }

  private analyzeDownDistance(gameState: GameStateData): string {
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo ?? 10;
    const fieldPosition = gameState.fieldPosition || 50;

    if (down === 4) {
      return `Critical 4th down and ${yardsToGo} creates all-or-nothing situation with major field position and momentum implications`;
    } else if (down === 3 && yardsToGo > 7) {
      return `3rd and long (${yardsToGo} yards) heavily favors defense with limited offensive options and pressure mounting`;
    } else if (down === 1 && yardsToGo <= 3) {
      return `Short yardage 1st down situation allows multiple play options and high conversion rate near ${fieldPosition}-yard line`;
    }

    return `${this.getOrdinal(down)} down and ${yardsToGo} from ${fieldPosition}-yard line creates moderate pressure with standard play calling`;
  }

  private analyzeFieldPosition(gameState: GameStateData): string {
    const fieldPosition = gameState.fieldPosition ?? 50;
    const possession = gameState.possession || 'Offense';

    if (fieldPosition <= 10) {
      return `Excellent field position inside 10-yard line gives ${possession} short field and high scoring probability`;
    } else if (fieldPosition <= 20) {
      return `Strong field position in red zone provides ${possession} with premium scoring opportunity and play-action options`;
    } else if (fieldPosition <= 35) {
      return `Good field position at ${fieldPosition}-yard line allows ${possession} aggressive play calling with manageable field goal range`;
    } else if (fieldPosition >= 80) {
      return `Poor field position deep in own territory forces ${possession} into conservative approach with limited big-play options`;
    }

    return `Neutral field position at ${fieldPosition}-yard line provides ${possession} with balanced offensive options and moderate field goal range`;
  }

  private analyzeRedZoneEfficiency(gameState: GameStateData): string {
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;
    const fieldPosition = gameState.fieldPosition ?? 20;

    const probability = this.calculateRedZoneTouchdownProbability(down, yardsToGo, fieldPosition);
    
    return `Red zone position at ${fieldPosition}-yard line shows ${probability}% touchdown probability with compressed field favoring defense`;
  }

  private calculateRedZoneTouchdownProbability(down: number, yardsToGo: number, fieldPosition: number): number {
    let baseProbability = 60; // Base red zone TD probability

    // Adjust for field position
    if (fieldPosition <= 5) baseProbability += 20;
    else if (fieldPosition <= 10) baseProbability += 10;
    else if (fieldPosition <= 15) baseProbability += 5;

    // Adjust for down
    if (down === 1) baseProbability += 15;
    else if (down === 2) baseProbability += 5;
    else if (down === 3) baseProbability -= 10;
    else if (down === 4) baseProbability += 10; // High stakes

    // Adjust for distance
    if (yardsToGo <= 3) baseProbability += 10;
    else if (yardsToGo >= 8) baseProbability -= 10;

    return Math.min(Math.max(baseProbability, 20), 85);
  }

  private analyzeTurnoverDifferential(gameState: GameStateData): string | null {
    const turnovers = gameState.turnovers;
    if (!turnovers || Math.abs(turnovers.differential) < 1) return null;

    const differential = turnovers.differential;
    const leadingTeam = differential > 0 ? gameState.homeTeam : gameState.awayTeam;
    
    if (Math.abs(differential) >= 3) {
      return `Significant ${Math.abs(differential)} turnover advantage for ${leadingTeam} creates major momentum and field position benefits`;
    } else if (Math.abs(differential) === 2) {
      return `${Math.abs(differential)} turnover differential favoring ${leadingTeam} provides substantial momentum and scoring opportunity advantages`;
    }

    return `Single turnover edge to ${leadingTeam} creates modest momentum advantage and improved field position opportunities`;
  }

  private analyzeWeatherImpact(weather: WeatherData, gameState: GameStateData): string | null {
    const windSpeed = weather.windSpeed || 0;
    const conditions = weather.conditions || '';
    const fieldPosition = gameState.fieldPosition || 50;

    if (windSpeed < 15 && !conditions.includes('rain') && !conditions.includes('snow')) return null;

    if (windSpeed >= 20) {
      return `Strong ${windSpeed}mph winds significantly impact passing accuracy and field goal attempts beyond 40 yards`;
    } else if (conditions.includes('rain') || conditions.includes('snow')) {
      return `Wet conditions favor ground game and increase fumble risk while reducing passing effectiveness and kicking accuracy`;
    } else if (windSpeed >= 15) {
      return `Moderate ${windSpeed}mph winds affect deep passing attempts and field goal accuracy from ${fieldPosition}-yard line`;
    }

    return null;
  }

  private getOrdinal(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return num + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
  }

  calculateConfidence(alert: AlertResult, gameState: GameStateData): number {
    let confidence = 0.5;

    if (gameState.down !== undefined && gameState.yardsToGo !== undefined) confidence += 0.15;
    if (gameState.fieldPosition !== undefined) confidence += 0.15;
    if (gameState.quarter) confidence += 0.1;
    if (gameState.turnovers) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  generateTags(alert: AlertResult, gameState: GameStateData): string[] {
    const tags: string[] = [gameState.sport.toLowerCase()];

    if (gameState.fieldPosition !== undefined && gameState.fieldPosition <= 20) {
      tags.push('red-zone');
    }
    if (gameState.down === 4) {
      tags.push('fourth-down');
    }
    if (gameState.turnovers && Math.abs(gameState.turnovers.differential) >= 2) {
      tags.push('turnover-battle');
    }
    if (gameState.quarter === 4) {
      tags.push('crunch-time');
    }

    return tags;
  }
}

// NBA/WNBA Insights Mapper
class NBAWNBAInsightsMapper extends BaseSportMapper {
  sport = 'NBA'; // Handles both NBA and WNBA

  async generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string[]> {
    const bullets: string[] = [];

    // Clutch time performance
    if (gameState.quarter && gameState.quarter >= 4) {
      const clutchAnalysis = this.analyzeClutchPerformance(gameState);
      bullets.push(this.formatBulletPoint(clutchAnalysis));
    }

    // Team foul situation
    if (gameState.fouls) {
      const foulAnalysis = this.analyzeFoulSituation(gameState);
      if (foulAnalysis) bullets.push(this.formatBulletPoint(foulAnalysis));
    }

    // Recent scoring runs
    if (gameState.recentScoring) {
      const scoringRunAnalysis = this.analyzeScoringRuns(gameState);
      if (scoringRunAnalysis) bullets.push(this.formatBulletPoint(scoringRunAnalysis));
    }

    // Star player impact
    if (gameState.starPlayers && gameState.starPlayers.length > 0) {
      const starPlayerAnalysis = this.analyzeStarPlayerImpact(gameState);
      bullets.push(this.formatBulletPoint(starPlayerAnalysis));
    }

    // Timeout usage
    if (gameState.timeouts) {
      const timeoutAnalysis = this.analyzeTimeoutUsage(gameState);
      if (timeoutAnalysis) bullets.push(this.formatBulletPoint(timeoutAnalysis));
    }

    return bullets.slice(0, 5);
  }

  async generateStructuredTemplate(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string> {
    // Generate alert header
    const alertType = (alert.type || 'BASKETBALL').toUpperCase().replace(/_/g, ' ');
    
    // Generate key information line
    const quarter = gameState.quarter || 1;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const winProb = this.calculateWinProbability(gameState);
    const quarterStr = quarter <= 4 ? `Q${quarter}` : 'OT';
    const keyLine = `💎 ${quarterStr} action (${winProb}% win chance) ${gameState.awayTeam} vs ${gameState.homeTeam} - ${scoreDiff}pt margin`;
    
    // Generate game situation
    const timeRemaining = gameState.timeRemaining || 'Live';
    let situationSection = `🎮 GAME SITUATION\n${gameState.awayTeam} ${gameState.awayScore} @ ${gameState.homeTeam} ${gameState.homeScore}\n📍 ${quarterStr} • ${timeRemaining} remaining`;
    
    // Add context info
    if (quarter >= 4 && scoreDiff <= 5) {
      situationSection += `\n🔥 Clutch time - tight game`;
    }
    
    // Add foul situation if available
    if (gameState.fouls) {
      const { home, away } = gameState.fouls;
      if (home >= 7 || away >= 7) {
        situationSection += `\n⚠️ Fouls: ${away}-${home} (bonus situation)`;
      }
    }
    
    // Add timeouts if available
    if (gameState.timeouts) {
      const { home, away } = gameState.timeouts;
      if (home <= 2 || away <= 2) {
        situationSection += `\n⏰ Timeouts: ${away}-${home} remaining`;
      }
    }
    
    return `${alertType} Alert\n\n${keyLine}\n\n${situationSection}`;
  }

  private calculateWinProbability(gameState: GameStateData): number {
    const quarter = gameState.quarter || 1;
    const scoreDiff = gameState.homeScore - gameState.awayScore;
    const timeRemaining = this.parseTimeToSeconds(gameState.timeRemaining || '12:00');
    
    let baseProbability = 50; // Even game
    
    // Adjust for score differential
    if (Math.abs(scoreDiff) >= 15) baseProbability = scoreDiff > 0 ? 80 : 20;
    else if (Math.abs(scoreDiff) >= 10) baseProbability = scoreDiff > 0 ? 70 : 30;
    else if (Math.abs(scoreDiff) >= 5) baseProbability = scoreDiff > 0 ? 60 : 40;
    
    // Adjust for game time (home team perspective)
    if (quarter >= 4 && timeRemaining < 300) { // Under 5 minutes
      if (Math.abs(scoreDiff) <= 3) baseProbability = 50; // Anyone's game
    }
    
    return Math.min(Math.max(baseProbability, 15), 85);
  }

  private analyzeClutchPerformance(gameState: GameStateData): string {
    const quarter = gameState.quarter || 4;
    const timeRemaining = gameState.timeRemaining || '';
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    if (quarter >= 5) {
      return `Overtime period amplifies clutch factor with every possession critical and shooting percentage variance increasing significantly`;
    } else if (timeSeconds <= 60) {
      return `Final minute execution becomes paramount with ${scoreDiff}-point differential creating maximum pressure on shot selection`;
    } else if (timeSeconds <= 120) {
      return `Two-minute warning territory demands clutch shooting and smart possessions with ${timeRemaining} remaining in regulation`;
    }

    return `Fourth quarter clutch time begins with ${timeRemaining} left - star players typically elevate performance levels`;
  }

  private analyzeFoulSituation(gameState: GameStateData): string | null {
    const fouls = gameState.fouls;
    const quarter = gameState.quarter || 1;
    
    if (!fouls || (fouls.home < 4 && fouls.away < 4)) return null;

    const homeFouls = fouls.home || 0;
    const awayFouls = fouls.away || 0;

    if (homeFouls >= 7 || awayFouls >= 7) {
      const teamInTrouble = homeFouls >= 7 ? gameState.homeTeam : gameState.awayTeam;
      return `${teamInTrouble} in severe foul trouble with ${Math.max(homeFouls, awayFouls)} team fouls creating automatic free throw situations`;
    } else if (homeFouls >= 5 || awayFouls >= 5) {
      const teamInTrouble = homeFouls >= 5 ? gameState.homeTeam : gameState.awayTeam;
      return `${teamInTrouble} approaching bonus situation with ${Math.max(homeFouls, awayFouls)} team fouls affecting defensive strategy significantly`;
    }

    return `Foul differential of ${Math.abs(homeFouls - awayFouls)} creates slight advantage in defensive aggressiveness and free throw opportunities`;
  }

  private analyzeScoringRuns(gameState: GameStateData): string | null {
    const scoring = gameState.recentScoring;
    if (!scoring) return null;

    const homeDiff = scoring.home || 0;
    const awayDiff = scoring.away || 0;
    const timeframe = scoring.timeframe || 'recent period';

    if (homeDiff >= 8 || awayDiff >= 8) {
      const runningTeam = homeDiff > awayDiff ? gameState.homeTeam : gameState.awayTeam;
      const runSize = Math.max(homeDiff, awayDiff);
      return `${runningTeam} on significant ${runSize}-point scoring run in ${timeframe} creating momentum and confidence advantages`;
    }

    return null;
  }

  private analyzeStarPlayerImpact(gameState: GameStateData): string {
    const starPlayers = gameState.starPlayers || [];
    const quarter = gameState.quarter || 1;
    
    if (starPlayers.length === 0) {
      return 'No standout individual performances identified but role players stepping up in crucial moments';
    }

    const topPerformer = starPlayers[0];
    
    if (quarter >= 4) {
      return `${topPerformer.name} (${topPerformer.position}) showing clutch performance - star players historically shoot higher percentage in fourth quarter`;
    }

    return `${topPerformer.name} (${topPerformer.position}) making significant impact with ${topPerformer.performance} affecting game flow and matchups`;
  }

  private analyzeTimeoutUsage(gameState: GameStateData): string | null {
    const timeouts = gameState.timeouts;
    const quarter = gameState.quarter || 1;
    
    if (!timeouts || quarter < 3) return null;

    const homeTimeouts = timeouts.home || 0;
    const awayTimeouts = timeouts.away || 0;

    if (quarter === 4) {
      if (homeTimeouts === 0 || awayTimeouts === 0) {
        const team = homeTimeouts === 0 ? gameState.homeTeam : gameState.awayTeam;
        return `${team} out of timeouts in fourth quarter limiting coaching adjustments and creating strategic disadvantage`;
      } else if (homeTimeouts === 1 || awayTimeouts === 1) {
        const team = homeTimeouts === 1 ? gameState.homeTeam : gameState.awayTeam;
        return `${team} down to final timeout in fourth quarter must use wisely for end-game situations`;
      }
    }

    return null;
  }

  calculateConfidence(alert: AlertResult, gameState: GameStateData): number {
    let confidence = 0.5;

    if (gameState.quarter && gameState.quarter >= 4) confidence += 0.2;
    if (gameState.fouls) confidence += 0.1;
    if (gameState.timeouts) confidence += 0.1;
    if (gameState.starPlayers && gameState.starPlayers.length > 0) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  generateTags(alert: AlertResult, gameState: GameStateData): string[] {
    const tags: string[] = [gameState.sport.toLowerCase()];

    if (gameState.quarter && gameState.quarter >= 4) {
      tags.push('clutch-time');
    }
    if (gameState.fouls && (gameState.fouls.home >= 5 || gameState.fouls.away >= 5)) {
      tags.push('foul-trouble');
    }
    if (gameState.quarter && gameState.quarter >= 5) {
      tags.push('overtime');
    }
    if (gameState.recentScoring) {
      tags.push('scoring-run');
    }

    return tags;
  }
}

// CFL Insights Mapper
class CFLInsightsMapper extends BaseSportMapper {
  sport = 'CFL';

  async generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string[]> {
    const bullets: string[] = [];

    // Rouge scoring opportunity
    if (gameState.down === 3 && gameState.fieldPosition !== undefined && gameState.fieldPosition <= 45) {
      const rougeAnalysis = this.analyzeRougeOpportunity(gameState);
      bullets.push(this.formatBulletPoint(rougeAnalysis));
    }

    // Field position for singles
    if (gameState.fieldPosition !== undefined) {
      const singlesAnalysis = this.analyzeSinglesOpportunity(gameState);
      if (singlesAnalysis) bullets.push(this.formatBulletPoint(singlesAnalysis));
    }

    // CFL-specific field advantages
    const fieldAdvantageAnalysis = this.analyzeCFLFieldAdvantages(gameState);
    bullets.push(this.formatBulletPoint(fieldAdvantageAnalysis));

    // 3-down system impact
    if (gameState.down !== undefined && gameState.yardsToGo !== undefined) {
      const threeDownAnalysis = this.analyzeThreeDownSystem(gameState);
      bullets.push(this.formatBulletPoint(threeDownAnalysis));
    }

    // Motion and positioning advantages
    const motionAnalysis = this.analyzeCFLMotionAdvantages(gameState);
    bullets.push(this.formatBulletPoint(motionAnalysis));

    return bullets.slice(0, 5);
  }

  async generateStructuredTemplate(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, oddsData?: ProcessedOdds | null): Promise<string> {
    // Generate alert header
    const alertType = (alert.type || 'CFL').toUpperCase().replace(/_/g, ' ');
    
    // Generate key information line
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;
    const touchdownProb = this.calculateCFLTouchdownProbability(gameState);
    const possession = gameState.possession || 'Team';
    const keyLine = `💎 ${this.getOrdinal(down)} & ${yardsToGo} (${touchdownProb}% TD chance) ${gameState.awayTeam} vs ${gameState.homeTeam} - ${possession} ball`;
    
    // Generate game situation
    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || 'Live';
    const fieldPos = gameState.fieldPosition !== undefined ? gameState.fieldPosition : 55; // CFL 110-yard field
    
    let situationSection = `🎮 GAME SITUATION\n${gameState.awayTeam} ${gameState.awayScore} @ ${gameState.homeTeam} ${gameState.homeScore}\n📍 Q${quarter} • ${timeRemaining} • ${this.getOrdinal(down)} & ${yardsToGo}\n🏟️ Field position: ${fieldPos}-yard line (110yd field)`;
    
    // Add CFL-specific context
    if (down === 3) {
      situationSection += `\n⚡ Critical 3rd down - must convert or punt`;
    }
    
    // Add rouge opportunity
    if (down === 3 && fieldPos <= 45) {
      situationSection += `\n🎯 Rouge opportunity (1pt guaranteed on missed FG)`;
    }
    
    // Add singles opportunity
    if (fieldPos <= 45) {
      situationSection += `\n⭐ Singles scoring opportunity`;
    }
    
    return `${alertType} Alert\n\n${keyLine}\n\n${situationSection}`;
  }

  private calculateCFLTouchdownProbability(gameState: GameStateData): number {
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;
    const fieldPosition = gameState.fieldPosition || 55;
    
    let baseProbability = 45; // Base probability for CFL
    
    // Adjust for field position (110-yard field)
    if (fieldPosition <= 10) baseProbability = 75;
    else if (fieldPosition <= 20) baseProbability = 65;
    else if (fieldPosition <= 35) baseProbability = 55;
    else if (fieldPosition >= 90) baseProbability = 15;
    
    // Adjust for down (3-down system)
    if (down === 1) baseProbability += 15;
    else if (down === 3) baseProbability += 10; // All-or-nothing
    else if (down === 2) baseProbability += 5;
    
    // Adjust for distance
    if (yardsToGo <= 3) baseProbability += 15;
    else if (yardsToGo >= 10) baseProbability -= 10;
    
    return Math.min(Math.max(baseProbability, 15), 85);
  }

  private analyzeRougeOpportunity(gameState: GameStateData): string {
    const fieldPosition = gameState.fieldPosition ?? 45;
    const yardsToGo = gameState.yardsToGo || 10;
    const estimatedFGDistance = fieldPosition + 10;

    return `3rd down rouge opportunity from ${fieldPosition}-yard line - ${estimatedFGDistance}-yard field goal attempt guarantees minimum 1 point even on miss`;
  }

  private analyzeSinglesOpportunity(gameState: GameStateData): string | null {
    const fieldPosition = gameState.fieldPosition ?? 50;
    
    if (fieldPosition > 45) return null;

    return `Prime field position at ${fieldPosition}-yard line creates singles opportunities through end zone kicks and strategic punting`;
  }

  private analyzeCFLFieldAdvantages(gameState: GameStateData): string {
    const possession = gameState.possession || 'Offense';
    
    return `CFL's 110-yard field with 20-yard end zones provides ${possession} extra space for deep routes and strategic kicking games`;
  }

  private analyzeThreeDownSystem(gameState: GameStateData): string {
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;

    if (down === 3) {
      return `Critical 3rd down with ${yardsToGo} yards needed - CFL's 3-down system creates maximum pressure for conversion or punt`;
    } else if (down === 2 && yardsToGo > 8) {
      return `2nd and long situation in CFL system increases passing frequency and creates predictable play-calling advantages for defense`;
    }

    return `${this.getOrdinal(down)} down and ${yardsToGo} in CFL 3-down system emphasizes aggressive play-calling and field position strategy`;
  }

  private analyzeCFLMotionAdvantages(gameState: GameStateData): string {
    const possession = gameState.possession || 'Offense';
    
    return `CFL motion rules allow unlimited backfield movement giving ${possession} significant pre-snap misdirection and formation advantages`;
  }

  private getOrdinal(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return num + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
  }

  calculateConfidence(alert: AlertResult, gameState: GameStateData): number {
    let confidence = 0.6; // Higher base for CFL due to unique rules

    if (gameState.down !== undefined && gameState.yardsToGo !== undefined) confidence += 0.15;
    if (gameState.fieldPosition !== undefined) confidence += 0.15;
    if (gameState.down === 3) confidence += 0.1; // Critical 3rd down

    return Math.min(confidence, 0.95);
  }

  generateTags(alert: AlertResult, gameState: GameStateData): string[] {
    const tags: string[] = ['cfl'];

    if (gameState.down === 3 && gameState.fieldPosition !== undefined && gameState.fieldPosition <= 45) {
      tags.push('rouge-opportunity');
    }
    if (gameState.fieldPosition !== undefined && gameState.fieldPosition <= 35) {
      tags.push('singles-opportunity');
    }
    if (gameState.down === 3) {
      tags.push('critical-down');
    }

    return tags;
  }
}

// Main GamblingInsightsComposer Class
export class GamblingInsightsComposer {
  private mappers: Map<string, BaseSportMapper>;

  constructor() {
    this.mappers = new Map();
    
    // Initialize sport-specific mappers
    this.mappers.set('MLB', new MLBInsightsMapper());
    this.mappers.set('NFL', new NFLNCAAFInsightsMapper());
    this.mappers.set('NCAAF', new NFLNCAAFInsightsMapper());
    this.mappers.set('NBA', new NBAWNBAInsightsMapper());
    this.mappers.set('WNBA', new NBAWNBAInsightsMapper());
    this.mappers.set('CFL', new CFLInsightsMapper());
  }

  /**
   * Compose gambling insights for an alert based on game state and weather data
   * @param alert - The alert result to enhance
   * @param gameState - Current game state data
   * @param weather - Optional weather data
   * @returns GamblingInsights object with structured template format
   */
  async compose(alert: AlertResult, gameState: GameStateData, weather?: WeatherData, userOddsEnabled: boolean = false, userApiKey?: string): Promise<GamblingInsights> {
    try {
      const sport = gameState.sport?.toUpperCase();
      const mapper = this.mappers.get(sport);

      if (!mapper) {
        console.warn(`No gambling insights mapper found for sport: ${sport}`);
        return this.createFallbackInsights(alert, gameState);
      }

      // Fetch odds data if enabled and available
      let oddsData: ProcessedOdds | null = null;
      if (userOddsEnabled && oddsApiService.isAvailable(userApiKey)) {
        try {
          const oddsArray = await oddsApiService.getOddsForSport(gameState.sport, userApiKey);
          // Find odds for this specific game
          oddsData = oddsArray.find(odds => 
            this.matchGameToOdds(gameState, odds)
          ) || null;
          
          if (oddsData) {
            console.log(`📊 Odds Data: Found market data for ${gameState.sport} game ${gameState.gameId}`);
          }
        } catch (error) {
          console.warn(`⚠️ Odds API: Failed to fetch odds for ${gameState.sport}:`, error);
          // Continue without odds data (graceful fallback)
        }
      }

      // Generate structured template instead of bullet points
      const structuredContent = await mapper.generateStructuredTemplate(alert, gameState, weather, oddsData);
      
      // Calculate confidence based on data availability
      const confidence = mapper.calculateConfidence(alert, gameState);
      
      // Generate relevant tags
      const tags = mapper.generateTags(alert, gameState);

      // Build gambling insights object with new structured format
      const insights: GamblingInsights = {
        structuredTemplate: structuredContent, // New structured format with emojis
        bullets: [structuredContent], // Fallback for backward compatibility
        confidence,
        tags: [...tags, 'gambling-insights', 'auto-generated'],
        // Market data from odds API
        market: oddsData ? this.processMarketData(oddsData) : undefined
      };

      // Add optional fields if relevant data is available
      if (this.shouldIncludeSituationAnalysis(alert, gameState)) {
        insights.situation = {
          context: this.generateSituationContext(alert, gameState),
          significance: this.calculateSituationSignificance(alert, gameState),
          timing: this.generateTimingContext(gameState)
        };
      }

      if (weather && this.hasSignificantWeatherImpact(weather)) {
        insights.weather = {
          impact: this.generateWeatherImpact(weather),
          conditions: weather.conditions || 'Variable conditions',
          severity: weather.severity || 'medium'
        };
      }

      return insights;

    } catch (error) {
      console.error('Error composing gambling insights:', error);
      return this.createFallbackInsights(alert, gameState);
    }
  }

  private createFallbackInsights(alert: AlertResult, gameState: GameStateData): GamblingInsights {
    const fallbackTemplate = `${(alert.type || 'GAME').toUpperCase().replace(/_/g, ' ')} Alert

💎 ${gameState.homeTeam} vs ${gameState.awayTeam} (${gameState.homeScore}-${gameState.awayScore})

🎮 GAME SITUATION
📍 Live game in progress
🎯 Monitor for betting opportunities`;

    return {
      bullets: [fallbackTemplate],
      confidence: 0.3,
      tags: ['gambling-insights', 'fallback', gameState.sport?.toLowerCase() || 'unknown']
    };
  }

  private shouldIncludeSituationAnalysis(alert: AlertResult, gameState: GameStateData): boolean {
    // Include situation analysis for high-impact alerts
    return alert.priority > 75 || 
           (gameState.quarter !== undefined && gameState.quarter >= 4) || 
           Math.abs(gameState.homeScore - gameState.awayScore) <= 7;
  }

  private generateSituationContext(alert: AlertResult, gameState: GameStateData): string {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const gamePhase = this.determineGamePhase(gameState);
    
    return `${alert.type} alert in ${gamePhase} with ${scoreDiff}-point differential affects live betting markets`;
  }

  private calculateSituationSignificance(alert: AlertResult, gameState: GameStateData): string {
    if (alert.priority >= 90) return 'High impact on live betting lines and market movement';
    if (alert.priority >= 75) return 'Moderate impact on betting opportunities and odds';
    return 'Low to moderate impact on current betting context';
  }

  private generateTimingContext(gameState: GameStateData): string {
    const sport = gameState.sport?.toUpperCase();
    
    switch (sport) {
      case 'MLB':
        return `${gameState.inning}${gameState.isTopInning ? 'T' : 'B'} inning, ${gameState.outs} out${gameState.outs !== 1 ? 's' : ''}`;
      case 'NFL':
      case 'NCAAF':
        return `Q${gameState.quarter}, ${gameState.timeRemaining} remaining`;
      case 'NBA':
      case 'WNBA':
        return `Q${gameState.quarter}, ${gameState.timeRemaining} on clock`;
      case 'CFL':
        return `Q${gameState.quarter}, ${gameState.timeRemaining} remaining in CFL action`;
      default:
        return 'Active game situation';
    }
  }

  private hasSignificantWeatherImpact(weather: WeatherData): boolean {
    return (weather.windSpeed && weather.windSpeed > 15) ||
           (weather.conditions && (weather.conditions.includes('rain') || weather.conditions.includes('snow'))) ||
           weather.severity === 'high';
  }

  private generateWeatherImpact(weather: WeatherData): string {
    const windSpeed = weather.windSpeed || 0;
    const conditions = weather.conditions || '';
    
    if (windSpeed > 20) {
      return `Strong winds (${windSpeed}mph) significantly impact passing games and kicking accuracy`;
    } else if (conditions.includes('rain')) {
      return 'Wet conditions favor ground games and increase turnover potential';
    } else if (conditions.includes('snow')) {
      return 'Snow conditions slow game pace and favor under betting trends';
    }
    
    return 'Weather conditions creating moderate impact on game dynamics';
  }

  private determineGamePhase(gameState: GameStateData): string {
    const sport = gameState.sport?.toUpperCase();
    
    switch (sport) {
      case 'MLB':
        const inning = gameState.inning || 1;
        if (inning <= 3) return 'early innings';
        if (inning <= 6) return 'middle innings';
        return 'late innings';
      case 'NFL':
      case 'NCAAF':
      case 'CFL':
        const quarter = gameState.quarter || 1;
        if (quarter <= 2) return 'first half';
        if (quarter === 3) return 'third quarter';
        return 'fourth quarter';
      case 'NBA':
      case 'WNBA':
        const q = gameState.quarter || 1;
        if (q <= 2) return 'first half';
        if (q === 3) return 'third quarter';
        if (q === 4) return 'fourth quarter';
        return 'overtime';
      default:
        return 'active game';
    }
  }

  /**
   * Enhance alerts with gambling insights for pipeline integration
   * @param alerts - Array of alerts to enhance
   * @param sport - Sport type for mapping
   * @returns Enhanced alerts with gambling insights attached
   */
  async enhanceAlertsWithGamblingInsights(alerts: AlertResult[], sport: string): Promise<AlertResult[]> {
    if (!alerts || alerts.length === 0) {
      return alerts;
    }

    console.log(`🎲 Composer: ${sport} enhancing ${alerts.length} alerts`);

    const enhancedAlerts: AlertResult[] = [];

    for (const alert of alerts) {
      try {
        // Build game state from alert data
        const gameState: GameStateData = this.buildGameStateFromAlert(alert, sport);
        
        // Get gambling insights using compose method (no user odds preferences)
        const gamblingInsights = await this.compose(alert, gameState, undefined, false);
        
        // Log bullet points for each alert as requested
        console.log(`🎯 Composer bullets: sport=${sport}, type=${alert.type}, bullets=${gamblingInsights.bullets?.length || 0}`);
        
        // Attach gambling insights to the alert
        const enhancedAlert: AlertResult = {
          ...alert,
          gamblingInsights,
          hasComposerEnhancement: (gamblingInsights.bullets?.length || 0) > 0
        };
        
        enhancedAlerts.push(enhancedAlert);
        
      } catch (error) {
        console.error(`❌ Error enhancing alert ${alert.alertKey} with gambling insights:`, error);
        // Include original alert without enhancement if error occurs
        enhancedAlerts.push({
          ...alert,
          hasComposerEnhancement: false
        });
      }
    }

    console.log(`🎲 Composer: ${sport} enhanced ${enhancedAlerts.length} alerts`);
    return enhancedAlerts;
  }

  /**
   * Build game state data from alert for gambling insights
   */
  private buildGameStateFromAlert(alert: AlertResult, sport: string): GameStateData {
    // Extract game state from alert context
    const gameState: GameStateData = {
      sport: sport,
      gameId: (alert as any).gameId || '',
      homeTeam: (alert as any).homeTeam || '',
      awayTeam: (alert as any).awayTeam || '',
      homeScore: (alert as any).homeScore || 0,
      awayScore: (alert as any).awayScore || 0,
      status: (alert as any).status || 'live',
      isLive: (alert as any).isLive || true,
      // Extract sport-specific fields from alert context if available
      ...this.extractSportSpecificFields(alert, sport)
    };

    return gameState;
  }

  /**
   * Extract sport-specific fields from alert context
   */
  private extractSportSpecificFields(alert: AlertResult, sport: string): Partial<GameStateData> {
    const context = alert.context || {};
    const fields: Partial<GameStateData> = {};

    switch (sport.toUpperCase()) {
      case 'MLB':
        fields.inning = context.inning;
        fields.isTopInning = context.isTopInning;
        fields.hasFirst = context.hasFirst;
        fields.hasSecond = context.hasSecond;
        fields.hasThird = context.hasThird;
        fields.outs = context.outs;
        fields.balls = context.balls;
        fields.strikes = context.strikes;
        fields.currentBatter = context.currentBatter;
        fields.onDeckBatter = context.onDeckBatter;
        fields.currentPitcher = context.currentPitcher;
        fields.pitchCount = context.pitchCount;
        break;
        
      case 'NFL':
      case 'NCAAF':
        fields.quarter = context.quarter;
        fields.down = context.down;
        fields.yardsToGo = context.yardsToGo;
        fields.fieldPosition = context.fieldPosition;
        fields.timeRemaining = context.timeRemaining;
        fields.possession = context.possession;
        fields.redZoneEfficiency = context.redZoneEfficiency;
        fields.turnovers = context.turnovers;
        break;
        
      case 'NBA':
      case 'WNBA':
        fields.quarter = context.quarter;
        fields.timeRemaining = context.timeRemaining;
        fields.fouls = context.fouls;
        fields.timeouts = context.timeouts;
        fields.shotClock = context.shotClock;
        fields.recentScoring = context.recentScoring;
        fields.starPlayers = context.starPlayers;
        break;
        
      case 'CFL':
        fields.quarter = context.quarter;
        fields.down = context.down;
        fields.yardsToGo = context.yardsToGo;
        fields.fieldPosition = context.fieldPosition;
        fields.timeRemaining = context.timeRemaining;
        fields.possession = context.possession;
        break;
    }

    // Add weather context if available
    if ((alert as any).weatherContext) {
      fields.weatherContext = (alert as any).weatherContext;
    }

    return fields;
  }

  /**
   * Match game state to odds data
   */
  private matchGameToOdds(gameState: GameStateData, odds: ProcessedOdds): boolean {
    // Simple team name matching - can be enhanced with more sophisticated matching
    const normalizeTeam = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');
    
    const stateHome = normalizeTeam(gameState.homeTeam);
    const stateAway = normalizeTeam(gameState.awayTeam);
    const oddsHome = normalizeTeam(odds.homeTeam);
    const oddsAway = normalizeTeam(odds.awayTeam);
    
    return (stateHome.includes(oddsHome) || oddsHome.includes(stateHome)) &&
           (stateAway.includes(oddsAway) || oddsAway.includes(stateAway));
  }

  /**
   * Process market data from odds API into GamblingInsights format
   */
  private processMarketData(oddsData: ProcessedOdds): GamblingInsights['market'] {
    const market: GamblingInsights['market'] = {};

    if (oddsData.markets.moneyline) {
      market.moneyline = {
        home: oddsData.markets.moneyline.home,
        away: oddsData.markets.moneyline.away
      };
    }

    if (oddsData.markets.spread) {
      market.spread = {
        points: oddsData.markets.spread.points,
        home: oddsData.markets.spread.home,
        away: oddsData.markets.spread.away
      };
    }

    if (oddsData.markets.total) {
      market.total = {
        points: oddsData.markets.total.points,
        over: oddsData.markets.total.over,
        under: oddsData.markets.total.under
      };
    }

    return market;
  }
}

// Export singleton instance
export const gamblingInsightsComposer = new GamblingInsightsComposer();