import type { AlertResult, GamblingInsights } from '../../shared/schema';

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
  abstract generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData): string[];
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

  generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData): string[] {
    const bullets: string[] = [];

    // On-deck batter analysis
    if (gameState.onDeckBatter && gameState.currentBatter) {
      const onDeckAnalysis = this.analyzeOnDeckBatter(gameState);
      bullets.push(this.formatBulletPoint(onDeckAnalysis));
    }

    // Wind impact on scoring
    if (weather?.windSpeed || gameState.weatherContext?.windSpeed) {
      const windImpact = this.analyzeWindImpact(weather || gameState.weatherContext);
      if (windImpact) bullets.push(this.formatBulletPoint(windImpact));
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

    return bullets.slice(0, 5); // Max 5 bullets
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

  generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData): string[] {
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
      const weatherImpact = this.analyzeWeatherImpact(weather || gameState.weatherContext, gameState);
      if (weatherImpact) bullets.push(this.formatBulletPoint(weatherImpact));
    }

    return bullets.slice(0, 5);
  }

  private analyzeDownDistance(gameState: GameStateData): string {
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;
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
    const fieldPosition = gameState.fieldPosition || 50;
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
    const fieldPosition = gameState.fieldPosition || 20;

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

  generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData): string[] {
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

  generateBulletPoints(alert: AlertResult, gameState: GameStateData, weather?: WeatherData): string[] {
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

  private analyzeRougeOpportunity(gameState: GameStateData): string {
    const fieldPosition = gameState.fieldPosition || 45;
    const yardsToGo = gameState.yardsToGo || 10;
    const estimatedFGDistance = fieldPosition + 10;

    return `3rd down rouge opportunity from ${fieldPosition}-yard line - ${estimatedFGDistance}-yard field goal attempt guarantees minimum 1 point even on miss`;
  }

  private analyzeSinglesOpportunity(gameState: GameStateData): string | null {
    const fieldPosition = gameState.fieldPosition || 50;
    
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
   * @returns GamblingInsights object with bullet points, confidence, and tags
   */
  compose(alert: AlertResult, gameState: GameStateData, weather?: WeatherData): GamblingInsights {
    try {
      const sport = gameState.sport?.toUpperCase();
      const mapper = this.mappers.get(sport);

      if (!mapper) {
        console.warn(`No gambling insights mapper found for sport: ${sport}`);
        return this.createFallbackInsights(alert, gameState);
      }

      // Generate sport-specific bullet points
      const bullets = mapper.generateBulletPoints(alert, gameState, weather);
      
      // Calculate confidence based on data availability
      const confidence = mapper.calculateConfidence(alert, gameState);
      
      // Generate relevant tags
      const tags = mapper.generateTags(alert, gameState);

      // Build gambling insights object
      const insights: GamblingInsights = {
        bullets: bullets.length > 0 ? bullets : ['Limited game state data available for detailed gambling insights'],
        confidence,
        tags: [...tags, 'gambling-insights', 'auto-generated']
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
    return {
      bullets: [
        `${gameState.sport} alert triggered for ${gameState.homeTeam} vs ${gameState.awayTeam} - monitor for betting implications`,
        `Current score ${gameState.homeScore}-${gameState.awayScore} creates specific market movement opportunities in live betting`,
        'General gambling advice: Consider game context, team form, and situational factors before placing any wagers'
      ],
      confidence: 0.3,
      tags: ['gambling-insights', 'fallback', gameState.sport?.toLowerCase() || 'unknown']
    };
  }

  private shouldIncludeSituationAnalysis(alert: AlertResult, gameState: GameStateData): boolean {
    // Include situation analysis for high-impact alerts
    return alert.priority > 75 || 
           gameState.quarter >= 4 || 
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
}

// Export singleton instance
export const gamblingInsightsComposer = new GamblingInsightsComposer();