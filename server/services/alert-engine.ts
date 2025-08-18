// chirpbot-alert-engine.ts
// Core Alert Logic for MLB, NFL, NBA & NHL - Predictive Alerts

interface GameContext {
  sport: 'MLB' | 'NFL' | 'NBA' | 'NHL';
  
  // Common fields
  homeScore: number;
  awayScore: number;
  windSpeed?: number;
  windDirectionChange?: number;
  temperature?: number;
  isDelayed?: boolean;
  resumedFromDelay?: boolean;
  
  // MLB-specific
  inning?: number;
  half?: 'top' | 'bottom';
  runnersOn?: string[]; // ['1B', '2B', '3B']
  outs?: number;
  batterHRsThisSeason?: number;
  batterHRsThisGame?: number;
  batterIsPowerHitter?: boolean;
  count?: { balls: number; strikes: number };
  
  // NFL-specific
  quarter?: number;
  timeRemainingSec?: number;
  down?: number;
  distance?: number;
  redZone?: boolean;
  playType?: string;
  fieldPosition?: number; // e.g., 30 means offense is on opponent 30-yard line
  isTwoMinWarning?: boolean;
  is4thDownConversion?: boolean;
  isTurnover?: boolean;
  
  // NBA-specific
  period?: number;
  timeRemainingMs?: number;
  foulTrouble?: boolean;
  clutchTime?: boolean;
  shotClock?: number;
  
  // NHL-specific
  periodNumber?: number;
  timeRemainingPeriodMs?: number;
  powerPlay?: boolean;
  manAdvantage?: number;
  goaliePulled?: boolean;
}

interface AlertResult {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  confidence: number;
  predictiveWindow: string; // e.g., "Next 2 minutes", "This at-bat"
  // Additional properties for route handling
  gameId?: string;
  sport?: string;
  homeTeam?: string;
  awayTeam?: string;
}

export function generatePredictiveAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];

  if (ctx.sport === 'MLB') {
    alerts.push(...generateMLBAlerts(ctx));
  } else if (ctx.sport === 'NFL') {
    alerts.push(...generateNFLAlerts(ctx));
  } else if (ctx.sport === 'NBA') {
    alerts.push(...generateNBAAlerts(ctx));
  } else if (ctx.sport === 'NHL') {
    alerts.push(...generateNHLAlerts(ctx));
  }

  return alerts.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function generateMLBAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];
  const runners = ctx.runnersOn || [];
  const outs = ctx.outs ?? 0;
  const inning = ctx.inning ?? 1;

  // Critical scoring opportunities
  if (runners.includes("2B") && runners.includes("3B") && outs === 0) {
    alerts.push({
      type: "RISP_CRITICAL",
      priority: "high",
      title: "🚨 High Scoring Probability",
      description: "Runners on 2nd & 3rd with no outs - 85% chance of scoring",
      confidence: 85,
      predictiveWindow: "This at-bat"
    });
  }

  if (runners.length === 3 && outs === 0) {
    alerts.push({
      type: "BASES_LOADED",
      priority: "high", 
      title: "🔥 Bases Loaded Opportunity",
      description: "Bases loaded, no outs - Prime scoring situation",
      confidence: 90,
      predictiveWindow: "Next 3 batters"
    });
  }

  if (runners.includes("3B") && outs === 0) {
    alerts.push({
      type: "RISP_MODERATE",
      priority: "medium",
      title: "⚾ Runner on 3rd Alert",
      description: "Runner 90 feet from home with no outs",
      confidence: 75,
      predictiveWindow: "This at-bat"
    });
  }

  // Late inning pressure situations
  if (inning >= 7 && Math.abs(ctx.homeScore - ctx.awayScore) <= 2) {
    alerts.push({
      type: "LATE_INNING_PRESSURE", 
      priority: "high",
      title: "⏱️ Late Inning Drama",
      description: `Close game in ${inning}th inning - Every at-bat matters`,
      confidence: 80,
      predictiveWindow: "Rest of game"
    });
  }

  if (inning === 9 && ctx.homeScore === ctx.awayScore) {
    alerts.push({
      type: "TIE_GAME_9TH",
      priority: "high",
      title: "🎯 Ninth Inning Tie Game",
      description: "Tie game entering the 9th - Next run likely wins",
      confidence: 95,
      predictiveWindow: "Next 30 minutes"
    });
  }

  // Power hitter situations
  if (ctx.batterIsPowerHitter && runners.length > 0 && inning >= 7) {
    alerts.push({
      type: "POWER_HITTER_RISP",
      priority: "high",
      title: "💣 Power Hitter + RISP",
      description: "Power hitter at bat with runners in scoring position",
      confidence: 70,
      predictiveWindow: "This at-bat"
    });
  }

  // Weather impact predictions
  if (ctx.windSpeed && ctx.windSpeed >= 7.5) {
    alerts.push({
      type: "WIND_ADVANTAGE",
      priority: "medium",
      title: "🌬️ Wind-Assisted Conditions",
      description: `${ctx.windSpeed} mph wind favoring home runs`,
      confidence: 65,
      predictiveWindow: "Current conditions"
    });
  }

  return alerts;
}

function generateNFLAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];
  const quarter = ctx.quarter ?? 0;
  const timeRemaining = ctx.timeRemainingSec ?? 3600;
  const down = ctx.down ?? 0;
  const distance = ctx.distance ?? 0;

  // Critical game moments
  if (quarter === 4 && timeRemaining <= 120) {
    alerts.push({
      type: "TWO_MINUTE_DRILL",
      priority: "high",
      title: "🚨 Two-Minute Drill",
      description: "Final 2 minutes - Every play is crucial",
      confidence: 95,
      predictiveWindow: "Next 2 minutes"
    });
  }

  if (quarter === 2 && timeRemaining <= 120) {
    alerts.push({
      type: "TWO_MIN_WARNING_HALF",
      priority: "medium",
      title: "⏳ Two-Minute Warning",
      description: "End of first half approaching - Score before break?",
      confidence: 70,
      predictiveWindow: "Before halftime"
    });
  }

  // Red zone opportunities
  if (ctx.redZone && quarter >= 3) {
    alerts.push({
      type: "RED_ZONE_SCORING",
      priority: "high",
      title: "🟥 Red Zone Opportunity",
      description: "Team in red zone - High probability touchdown drive",
      confidence: 75,
      predictiveWindow: "Next 4 plays"
    });
  }

  if (ctx.redZone && down === 3 && distance <= 5) {
    alerts.push({
      type: "RED_ZONE_CRITICAL",
      priority: "high", 
      title: "🔥 3rd & Short in Red Zone",
      description: "Critical down in scoring territory",
      confidence: 80,
      predictiveWindow: "This play"
    });
  }

  // High-stakes decisions
  if (ctx.is4thDownConversion) {
    alerts.push({
      type: "FOURTH_DOWN_CONVERSION",
      priority: "high",
      title: "⚠️ 4th Down Decision",
      description: "Going for it on 4th down - Momentum shifter",
      confidence: 85,
      predictiveWindow: "This play"
    });
  }

  // Game-winning situations
  if (ctx.fieldPosition && ctx.fieldPosition <= 35 && ctx.redZone && timeRemaining <= 180) {
    alerts.push({
      type: "GAME_WINNING_DRIVE",
      priority: "high",
      title: "📣 Game-Winning Drive",
      description: "Potential game-winning drive starting in red zone",
      confidence: 90,
      predictiveWindow: "Next 3 minutes"
    });
  }

  return alerts;
}

function generateNBAAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];

  if (ctx.clutchTime) {
    alerts.push({
      type: "CLUTCH_TIME",
      priority: "high",
      title: "🏀 Clutch Time",
      description: "Final 2 minutes of close game - Every possession counts",
      confidence: 90,
      predictiveWindow: "Final 2 minutes"
    });
  }

  if (ctx.shotClock && ctx.shotClock <= 5) {
    alerts.push({
      type: "SHOT_CLOCK_PRESSURE",
      priority: "medium",
      title: "⏰ Shot Clock Pressure",
      description: "Shot clock winding down - Forced shot incoming",
      confidence: 75,
      predictiveWindow: "Next 5 seconds"
    });
  }

  return alerts;
}

function generateNHLAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];

  if (ctx.powerPlay) {
    alerts.push({
      type: "POWER_PLAY",
      priority: "high",
      title: "⚡ Power Play Opportunity",
      description: `${ctx.manAdvantage}-man advantage - Prime scoring chance`,
      confidence: 80,
      predictiveWindow: "Next 2 minutes"
    });
  }

  if (ctx.goaliePulled) {
    alerts.push({
      type: "EMPTY_NET",
      priority: "high",
      title: "🥅 Empty Net Situation",
      description: "Goalie pulled - High-stakes final minutes",
      confidence: 85,
      predictiveWindow: "Final minutes"
    });
  }

  return alerts;
}

// Export for use in route handlers
export { GameContext, AlertResult };