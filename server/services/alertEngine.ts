// chirpbot-alert-engine.ts
// Core Alert Logic for MLB, NFL, NBA, NHL

interface GameContext {
  sport: 'MLB' | 'NFL' | 'NBA' | 'NHL';
  
  // MLB & Common
  inning?: number;
  half?: 'top' | 'bottom';
  homeScore: number;
  awayScore: number;
  runnersOn?: string[]; // MLB
  outs?: number;
  
  // Weather
  windSpeed?: number;
  windDirectionChange?: number;
  temperature?: number;
  isDelayed?: boolean;
  resumedFromDelay?: boolean;
  
  // MLB Batter stats
  batterHRsThisSeason?: number;
  batterHRsThisGame?: number;
  batterIsPowerHitter?: boolean;

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
  timeRemainingMin?: number;
  clutchTime?: boolean; // Last 5 minutes of 4th quarter or overtime
  leadChanges?: number;
  isOverttime?: boolean;
  
  // NHL-specific
  period_nhl?: number;
  timeRemainingMinNHL?: number;
  powerPlay?: boolean;
  shortHanded?: boolean;
  emptyNet?: boolean;
  thirdPeriodTied?: boolean;
}

interface AlertResult {
  type: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  sport: string;
}

export function checkAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];

  if (ctx.sport === 'MLB') {
    alerts.push(...checkMLBAlerts(ctx));
  } else if (ctx.sport === 'NFL') {
    alerts.push(...checkNFLAlerts(ctx));
  } else if (ctx.sport === 'NBA') {
    alerts.push(...checkNBAAlerts(ctx));
  } else if (ctx.sport === 'NHL') {
    alerts.push(...checkNHLAlerts(ctx));
  }

  return alerts;
}

function checkMLBAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];
  const runners = ctx.runnersOn || [];
  const o = ctx.outs ?? 0;

  // Game state alerts
  if (ctx.inning === 7 && o === 0) {
    alerts.push({
      type: 'SEVENTH_INNING_WARNING',
      message: '7th Inning Game Warning',
      priority: 'medium',
      sport: 'MLB'
    });
  }
  
  if (ctx.inning === 1 && ctx.half === 'top') {
    alerts.push({
      type: 'GAME_START',
      message: 'Game Start Alert',
      priority: 'low',
      sport: 'MLB'
    });
  }
  
  if (ctx.inning === 9 && ctx.homeScore === ctx.awayScore) {
    alerts.push({
      type: 'TIE_NINTH',
      message: 'Tie Game Going Into 9th',
      priority: 'high',
      sport: 'MLB'
    });
  }

  // Runner in scoring position (RISP) alerts
  if (runners.includes("2B") && runners.includes("3B") && o === 0) {
    alerts.push({
      type: 'RISP_HIGH',
      message: 'Runners on 2nd & 3rd, 0 Outs',
      priority: 'high',
      sport: 'MLB'
    });
  }
  
  if (runners.length === 3 && o === 0) {
    alerts.push({
      type: 'BASES_LOADED_HIGH',
      message: 'Bases Loaded, 0 Outs',
      priority: 'high',
      sport: 'MLB'
    });
  }
  
  if (runners.includes("3B") && o === 0) {
    alerts.push({
      type: 'THIRD_BASE_HIGH',
      message: 'Runner on 3rd, 0 Outs',
      priority: 'high',
      sport: 'MLB'
    });
  }

  // Weather alerts
  if (ctx.windSpeed && ctx.windSpeed >= 7.5) {
    alerts.push({
      type: 'WIND_ADVANTAGE',
      message: 'Wind ≥ 7.5 mph Toward Outfield',
      priority: 'medium',
      sport: 'MLB'
    });
  }
  
  if (ctx.windDirectionChange && ctx.windDirectionChange >= 45) {
    alerts.push({
      type: 'WIND_SHIFT',
      message: 'Wind Direction Shift ≥ 45°',
      priority: 'medium',
      sport: 'MLB'
    });
  }

  // Batter alerts
  if (ctx.batterHRsThisSeason && ctx.batterHRsThisSeason >= 20) {
    alerts.push({
      type: 'POWER_BATTER',
      message: 'Batter with 20+ HRs This Season',
      priority: 'medium',
      sport: 'MLB'
    });
  }
  
  if (ctx.batterIsPowerHitter && runners.length > 0 && (ctx.inning ?? 0) >= 7) {
    alerts.push({
      type: 'CLUTCH_POWER_RISP',
      message: 'Power Hitter + RISP in 7th+ Inning',
      priority: 'high',
      sport: 'MLB'
    });
  }

  return alerts;
}

function checkNFLAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];
  const q = ctx.quarter ?? 0;
  const t = ctx.timeRemainingSec ?? 3600;
  const down = ctx.down ?? 0;
  const dist = ctx.distance ?? 0;

  // Game state alerts
  if (q === 1 && t >= 840) {
    alerts.push({
      type: 'KICKOFF',
      message: 'Game Kickoff',
      priority: 'low',
      sport: 'NFL'
    });
  }
  
  if (q === 2 && t <= 120) {
    alerts.push({
      type: 'TWO_MIN_WARNING_HALF',
      message: '2-Min Warning Before Half',
      priority: 'medium',
      sport: 'NFL'
    });
  }
  
  if (q === 4 && t <= 120) {
    alerts.push({
      type: 'TWO_MIN_DRILL',
      message: '2-Min Drill (Q4)',
      priority: 'high',
      sport: 'NFL'
    });
  }

  // Red zone alerts
  if (ctx.redZone && q >= 3) {
    alerts.push({
      type: 'RED_ZONE_OPP',
      message: 'Red Zone Opportunity',
      priority: 'high',
      sport: 'NFL'
    });
  }
  
  if (ctx.redZone && down === 3 && dist <= 5) {
    alerts.push({
      type: 'RED_ZONE_THIRD_SHORT',
      message: '3rd & Short in Red Zone',
      priority: 'high',
      sport: 'NFL'
    });
  }

  // Critical downs
  if (ctx.is4thDownConversion) {
    alerts.push({
      type: 'FOURTH_DOWN_CONVERSION',
      message: 'Going for it on 4th Down',
      priority: 'high',
      sport: 'NFL'
    });
  }

  // Turnovers
  if (ctx.isTurnover) {
    alerts.push({
      type: 'TURNOVER',
      message: 'Turnover!',
      priority: 'high',
      sport: 'NFL'
    });
  }

  return alerts;
}

function checkNBAAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];
  const period = ctx.period ?? 0;
  const timeLeft = ctx.timeRemainingMin ?? 0;

  // Clutch time alert
  if (ctx.clutchTime) {
    alerts.push({
      type: 'CLUTCH_TIME',
      message: 'Clutch Time - Under 5 Minutes in 4th Quarter',
      priority: 'high',
      sport: 'NBA'
    });
  }

  // Overtime alert
  if (ctx.isOverttime) {
    alerts.push({
      type: 'OVERTIME',
      message: 'Game Goes to Overtime',
      priority: 'high',
      sport: 'NBA'
    });
  }

  // Lead changes
  if (ctx.leadChanges && ctx.leadChanges >= 10) {
    alerts.push({
      type: 'HIGH_LEAD_CHANGES',
      message: `${ctx.leadChanges} Lead Changes - Competitive Game`,
      priority: 'medium',
      sport: 'NBA'
    });
  }

  // Fourth quarter close game
  if (period === 4 && timeLeft <= 2 && Math.abs(ctx.homeScore - ctx.awayScore) <= 5) {
    alerts.push({
      type: 'CLOSE_FINISH',
      message: 'Under 2 Minutes - Close Game',
      priority: 'high',
      sport: 'NBA'
    });
  }

  return alerts;
}

function checkNHLAlerts(ctx: GameContext): AlertResult[] {
  const alerts: AlertResult[] = [];
  const period = ctx.period_nhl ?? 0;
  const timeLeft = ctx.timeRemainingMinNHL ?? 0;

  // Power play alerts
  if (ctx.powerPlay) {
    alerts.push({
      type: 'POWER_PLAY',
      message: 'Power Play Opportunity',
      priority: 'medium',
      sport: 'NHL'
    });
  }

  // Empty net alerts
  if (ctx.emptyNet) {
    alerts.push({
      type: 'EMPTY_NET',
      message: 'Empty Net - Goalie Pulled',
      priority: 'high',
      sport: 'NHL'
    });
  }

  // Third period tied
  if (ctx.thirdPeriodTied && period === 3) {
    alerts.push({
      type: 'THIRD_PERIOD_TIED',
      message: 'Tied Game in 3rd Period',
      priority: 'high',
      sport: 'NHL'
    });
  }

  // Final minutes
  if (period === 3 && timeLeft <= 5 && Math.abs(ctx.homeScore - ctx.awayScore) <= 1) {
    alerts.push({
      type: 'FINAL_MINUTES_CLOSE',
      message: 'Under 5 Minutes - One Goal Game',
      priority: 'high',
      sport: 'NHL'
    });
  }

  return alerts;
}

// Filter alerts based on user settings
export function filterAlertsBySettings(alerts: AlertResult[], settings: any): AlertResult[] {
  return alerts.filter(alert => {
    // MLB alert filtering
    if (alert.sport === 'MLB') {
      if (alert.type.includes('SEVENTH_INNING') || alert.type.includes('GAME_START') || alert.type.includes('TIE_NINTH')) {
        return settings.gameStateAlerts !== false;
      }
      if (alert.type.includes('RISP') || alert.type.includes('BASES_LOADED') || alert.type.includes('THIRD_BASE')) {
        return settings.rispAlerts !== false;
      }
      if (alert.type.includes('WIND') || alert.type.includes('WEATHER')) {
        return settings.weatherAlerts !== false;
      }
      if (alert.type.includes('BATTER') || alert.type.includes('POWER') || alert.type.includes('CLUTCH_POWER')) {
        return settings.batterAlerts !== false;
      }
    }
    
    // NFL alert filtering
    if (alert.sport === 'NFL') {
      if (alert.type.includes('RED_ZONE')) {
        return settings.redZoneAlerts !== false;
      }
      if (alert.type.includes('TWO_MIN')) {
        return settings.twoMinuteAlerts !== false;
      }
      if (alert.type.includes('FOURTH_DOWN')) {
        return settings.fourthDownAlerts !== false;
      }
      if (alert.type.includes('TURNOVER')) {
        return settings.turnoverAlerts !== false;
      }
    }
    
    // NBA alert filtering
    if (alert.sport === 'NBA') {
      if (alert.type.includes('CLUTCH_TIME')) {
        return settings.clutchTimeAlerts !== false;
      }
      if (alert.type.includes('OVERTIME')) {
        return settings.overtimeAlerts !== false;
      }
      if (alert.type.includes('LEAD_CHANGES')) {
        return settings.leadChangeAlerts !== false;
      }
      if (alert.type.includes('CLOSE')) {
        return settings.closeGameAlerts !== false;
      }
    }
    
    // NHL alert filtering
    if (alert.sport === 'NHL') {
      if (alert.type.includes('POWER_PLAY')) {
        return settings.powerPlayAlerts !== false;
      }
      if (alert.type.includes('EMPTY_NET')) {
        return settings.emptyNetAlerts !== false;
      }
      if (alert.type.includes('THIRD_PERIOD')) {
        return settings.thirdPeriodAlerts !== false;
      }
      if (alert.type.includes('FINAL_MINUTES')) {
        return settings.finalMinutesAlerts !== false;
      }
    }
    
    return true; // Default to showing alert if no specific rule matches
  });
}

// Generate context from game data for alert checking
export function generateGameContext(gameData: any, sport: string): GameContext {
  const ctx: GameContext = {
    sport: sport as any,
    homeScore: gameData.homeScore || 0,
    awayScore: gameData.awayScore || 0,
  };

  if (sport === 'MLB') {
    ctx.inning = gameData.inning || 1;
    ctx.half = gameData.half || 'top';
    ctx.outs = gameData.outs || 0;
    ctx.runnersOn = gameData.runnersOn || [];
    // Add weather and batter data when available
    ctx.windSpeed = gameData.windSpeed;
    ctx.temperature = gameData.temperature;
    ctx.batterHRsThisSeason = gameData.batterHRsThisSeason;
  } else if (sport === 'NFL') {
    ctx.quarter = gameData.quarter || 1;
    ctx.timeRemainingSec = gameData.timeRemainingSec || 900;
    ctx.down = gameData.down;
    ctx.distance = gameData.distance;
    ctx.redZone = gameData.redZone || false;
    ctx.fieldPosition = gameData.fieldPosition;
  } else if (sport === 'NBA') {
    ctx.period = gameData.period || 1;
    ctx.timeRemainingMin = gameData.timeRemainingMin || 12;
    ctx.clutchTime = gameData.clutchTime || false;
    ctx.leadChanges = gameData.leadChanges || 0;
    ctx.isOverttime = gameData.isOverttime || false;
  } else if (sport === 'NHL') {
    ctx.period_nhl = gameData.period || 1;
    ctx.timeRemainingMinNHL = gameData.timeRemainingMin || 20;
    ctx.powerPlay = gameData.powerPlay || false;
    ctx.emptyNet = gameData.emptyNet || false;
    ctx.thirdPeriodTied = gameData.thirdPeriodTied || false;
  }

  return ctx;
}