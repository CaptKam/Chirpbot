export interface Team {
  id: string;
  name: string;
  initials: string;
  sport: string;
  logoColor: string;
  monitored: boolean;
  externalId?: string | null;
}

export interface Alert {
  id: string;
  type: string;
  sport: string;
  title: string;
  description: string;
  message?: string;
  gameId?: string;
  aiContext?: string | null;
  aiConfidence?: number | null;
  confidence?: number;
  priority?: number;
  probability?: number;
  homeTeam?: string | { name: string; id?: string; abbreviation?: string };
  awayTeam?: string | { name: string; id?: string; abbreviation?: string };
  homeScore?: number;
  awayScore?: number;
  inning?: number;
  isTopInning?: boolean;
  balls?: number;
  strikes?: number;
  outs?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  weather?: {
    temperature: number;
    condition: string;
    windSpeed?: number;
    windDirection?: string;
  };
  context?: {
    homeScore?: number;
    awayScore?: number;
    inning?: number;
    isTopInning?: boolean;
    balls?: number;
    strikes?: number;
    outs?: number;
    hasFirst?: boolean;
    hasSecond?: boolean;
    hasThird?: boolean;
    weather?: {
      temperature: number;
      condition: string;
      windSpeed?: number;
      windDirection?: string;
    };
    quarter?: number;
    timeRemaining?: string;
    down?: number;
    yardsToGo?: number;
    fieldPosition?: string;
    courtPosition?: string;
    period?: number;
    rinkPosition?: string;
    betbookData?: any;
    gameInfo?: any;
    reasons?: string[];
    recommendation?: string;
    confidence?: number;
    homeTeam?: string | { name: string; id?: string; abbreviation?: string };
    awayTeam?: string | { name: string; id?: string; abbreviation?: string };
    scoringProbability?: number;
    aiBettingAdvice?: {
      recommendation: string;
      confidence: number;
      reasoning: string[];
      suggestedBets: string[];
    };
    aiGameProjection?: {
      finalScorePrediction: string;
      keyMoments: string[];
      winProbability: { home: number; away: number };
    };
    aiInsights?: string[];
    aiTitle?: string;
    aiCallToAction?: string;
    // MLB-specific fields
    currentBatter?: string;
    onDeckBatter?: string;
    currentPitcher?: string;
    isPowerHitter?: boolean;
    windSpeed?: number;
    windDirection?: string;
    windImpact?: string;
  };
  gameInfo?: {
    homeTeam: string;
    awayTeam: string;
    quarter?: string;
    inning?: string;
    period?: string;
    status: string;
  };
  weatherData?: {
    temperature: number;
    condition: string;
    windSpeed?: number;
    windDirection?: string;
  } | null;
  timestamp: string;
  createdAt?: string;
  sentToTelegram: boolean;
  betbookData?: any;
}

export interface Settings {
  id: string;
  sport: string;
  alertTypes: {
    // MLB Alert Types - Game Situations
    risp?: boolean;
    basesLoaded?: boolean;
    runnersOnBase?: boolean;
    closeGame?: boolean;
    lateInning?: boolean;
    extraInnings?: boolean;
    
    // MLB Alert Types - Scoring Events
    homeRun?: boolean;
    homeRunAlert?: boolean;
    hits?: boolean;
    scoring?: boolean;
    inningChange?: boolean;
    
    // MLB Alert Types - Player Performance  
    strikeouts?: boolean;
    powerHitter?: boolean;
    powerHitterOnDeck?: boolean;
    starBatter?: boolean;
    eliteClutch?: boolean;
    avgHitter?: boolean;
    rbiMachine?: boolean;
    
    // NFL Alert Types  
    redZone?: boolean;
    nflCloseGame?: boolean;
    fourthDown?: boolean;
    twoMinuteWarning?: boolean;
    
    // NBA Alert Types
    clutchTime?: boolean;
    nbaCloseGame?: boolean;
    overtime?: boolean;
    
    // NHL Alert Types
    powerPlay?: boolean;
    nhlCloseGame?: boolean;
    emptyNet?: boolean;
    
    // NCAAF (College Football) Alert Types
    ncaafRedZone?: boolean;
    ncaafFourthDown?: boolean;
    ncaafTwoMinuteWarning?: boolean;
    ncaafCloseGame?: boolean;
    ncaafOvertime?: boolean;
    ncaafGoalLineStand?: boolean;
    ncaafBigPlayPotential?: boolean;
    ncaafGameLive?: boolean;
  };
  aiEnabled: boolean;
  aiConfidenceThreshold: number;
  telegramEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

