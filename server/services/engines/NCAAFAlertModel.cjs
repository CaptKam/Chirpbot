// NCAAFAlertModel.cjs - DISABLED
//
// COLLEGE FOOTBALL ALERT MODEL COMPLETELY DISABLED
// This module has been disabled to prevent any NCAAF alert generation.
// All functions now return "no alert" results to maintain compatibility.

// Baseline probability of scoring from different field positions and down/distance
// Keys are field position zones and down. Values are probabilities based on college football analytics.
const SCORE_PROB_BASE = {
  // Red Zone (0-20 yards from goal)
  redZone: {
    1: 0.75, 2: 0.68, 3: 0.55, 4: 0.45
  },
  // Green Zone (21-40 yards from goal) 
  greenZone: {
    1: 0.45, 2: 0.38, 3: 0.28, 4: 0.15
  },
  // Mid Field (41-60 yards from goal)
  midField: {
    1: 0.25, 2: 0.20, 3: 0.15, 4: 0.08
  },
  // Far Field (61+ yards from goal)
  farField: {
    1: 0.12, 2: 0.08, 3: 0.05, 4: 0.02
  }
};

// Two-minute drill success rates by field position
const TWO_MINUTE_PROB = {
  redZone: 0.82,
  greenZone: 0.55,
  midField: 0.35,
  farField: 0.18
};

/**
 * Determine field position zone based on yards to goal
 */
function getFieldZone(yardsToGoal) {
  if (yardsToGoal <= 20) return 'redZone';
  if (yardsToGoal <= 40) return 'greenZone';
  if (yardsToGoal <= 60) return 'midField';
  return 'farField';
}

/**
 * Clamp a probability value between 0 and 0.95
 */
function clamp01(x) {
  return Math.max(0, Math.min(0.95, x));
}

/**
 * Apply situational modifiers to base probability
 */
function applyNCAAFModifiers(gs, p, reasons) {
  const { quarter, timeRemaining, down, distance, yardsToGoal, score, offense, defense } = gs;
  
  // Late game leverage (4th quarter, close game)
  const scoreDiff = Math.abs(score.home - score.away);
  if (quarter >= 4 && scoreDiff <= 7) {
    p += 0.08;
    reasons.push('late game leverage +0.08');
  }

  // Two-minute drill bonus
  if (timeRemaining <= 120) { // 2 minutes
    p += 0.06;
    reasons.push('two-minute drill +0.06');
  }

  // 4th down desperation boost
  if (down === 4) {
    p += 0.10;
    reasons.push('4th down desperation +0.10');
  }

  // Short yardage boost (goal line, 3rd/4th and short)
  if (yardsToGoal <= 5 && distance <= 2) {
    p += 0.12;
    reasons.push('goal line short yardage +0.12');
  } else if (distance <= 2 && down >= 3) {
    p += 0.05;
    reasons.push('short yardage conversion +0.05');
  }

  // 3rd down conversion critical
  if (down === 3) {
    p += 0.04;
    reasons.push('3rd down critical +0.04');
  }

  // Momentum from recent big plays
  if (gs.momentumFactor && gs.momentumFactor > 1.2) {
    p += 0.06;
    reasons.push('positive momentum +0.06');
  }

  // Weather conditions (outdoor games)
  if (gs.weather && !gs.weather.dome) {
    if (gs.weather.windMph >= 15) {
      p -= 0.03;
      reasons.push('high wind penalty -0.03');
    }
    if (gs.weather.precipitation) {
      p -= 0.02;
      reasons.push('precipitation penalty -0.02');
    }
  }

  // Time of possession advantage
  if (gs.topAdvantage && gs.topAdvantage > 10) {
    p += 0.03;
    reasons.push('TOP advantage +0.03');
  }

  return clamp01(p);
}

/**
 * Calculate scoring probability and classify into severity bands
 */
function calcNCAAFScoringAlert(gs) {
  const zone = getFieldZone(gs.yardsToGoal);
  const down = Math.min(4, Math.max(1, gs.down));
  
  let p_base = SCORE_PROB_BASE[zone][down] || 0.05;
  
  // Special case for two-minute drill
  if (gs.timeRemaining <= 120) {
    p_base = Math.max(p_base, TWO_MINUTE_PROB[zone] || 0.1);
  }

  const reasons = [`${zone} ${down}/${gs.distance} baseline ${p_base.toFixed(2)}`];
  const p_adj = applyNCAAFModifiers(gs, p_base, reasons);
  
  let severity = 'NONE';
  let priority = 60;
  
  if (p_adj >= 0.75) {
    severity = 'HIGH';
    priority = 95;
  } else if (p_adj >= 0.60) {
    severity = 'MED';
    priority = 85;
  } else if (p_adj >= 0.45) {
    severity = 'LOW';
    priority = 75;
  }
  
  return { p_base, p_adj, severity, priority, reasons };
}

/**
 * Check for red zone scoring opportunities
 */
function checkRedZone(gs) {
  // More selective redzone alerts - only fire on HIGH impact situations
  if (gs.yardsToGoal <= 20) {
    const result = calcNCAAFScoringAlert(gs);
    
    // Only alert on HIGH severity redzone situations or critical downs
    const isHighImpact = result.severity === 'HIGH' || 
                        (gs.down >= 3 && gs.yardsToGoal <= 10) || 
                        (gs.down === 4 && gs.yardsToGoal <= 20);
    
    if (!isHighImpact) {
      return { shouldAlert: false };
    }
    
    return {
      shouldAlert: true,
      reasons: [`Critical Red Zone: ${gs.down}/${gs.distance} at ${gs.yardsToGoal}yd line`],
      priority: result.priority + 5, // Red zone bonus
      probability: result.p_adj,
      severity: result.severity,
      alertType: 'redZone'
    };
  }
  return { shouldAlert: false };
}

/**
 * Check for 4th down conversion attempts
 */
function checkFourthDown(gs) {
  if (gs.down === 4 && gs.distance <= 10) {
    const result = calcNCAAFScoringAlert(gs);
    return {
      shouldAlert: true,
      reasons: [`4th & ${gs.distance} at ${gs.yardsToGoal}yd line`],
      priority: result.priority + 10, // 4th down is always critical
      probability: result.p_adj,
      severity: result.severity === 'NONE' ? 'LOW' : result.severity,
      alertType: 'fourthDown'
    };
  }
  return { shouldAlert: false };
}

/**
 * Check for two-minute drill scenarios
 */
function checkTwoMinuteWarning(gs) {
  if (gs.timeRemaining <= 120 && gs.timeRemaining > 0) {
    const zone = getFieldZone(gs.yardsToGoal);
    const prob = TWO_MINUTE_PROB[zone] || 0.1;
    
    return {
      shouldAlert: prob >= 0.25,
      reasons: [`Two-minute drill: ${Math.floor(gs.timeRemaining/60)}:${(gs.timeRemaining%60).toString().padStart(2,'0')} remaining`],
      priority: prob >= 0.5 ? 90 : 80,
      probability: prob,
      severity: prob >= 0.5 ? 'HIGH' : 'MED',
      alertType: 'twoMinuteWarning'
    };
  }
  return { shouldAlert: false };
}

/**
 * Check for close game situations
 */
function checkCloseGame(gs) {
  const scoreDiff = Math.abs(gs.score.home - gs.score.away);
  const isLateGame = gs.quarter >= 4 || gs.quarter === 'OT';
  
  if (isLateGame && scoreDiff <= 7) {
    return {
      shouldAlert: true,
      reasons: [`Close game: ${scoreDiff} point difference in ${gs.quarter === 'OT' ? 'overtime' : '4th quarter'}`],
      priority: scoreDiff <= 3 ? 95 : 85,
      probability: 0.75,
      severity: scoreDiff <= 3 ? 'HIGH' : 'MED',
      alertType: 'ncaafCloseGame'
    };
  }
  return { shouldAlert: false };
}

/**
 * Check for overtime situations
 */
function checkOvertime(gs) {
  if (gs.quarter === 'OT' || gs.quarter === 'OT2' || gs.quarter === 'OT3') {
    return {
      shouldAlert: true,
      reasons: [`Overtime period: ${gs.quarter}`],
      priority: 100,
      probability: 0.90,
      severity: 'HIGH',
      alertType: 'overtime'
    };
  }
  return { shouldAlert: false };
}

/**
 * Check for goal line stands (defense within 5 yards)
 */
function checkGoalLineStand(gs) {
  if (gs.yardsToGoal <= 5 && gs.down >= 3) {
    return {
      shouldAlert: true,
      reasons: [`Goal line stand: ${gs.down}/${gs.distance} at ${gs.yardsToGoal}yd line`],
      priority: 90,
      probability: 0.80,
      severity: 'HIGH',
      alertType: 'goalLineStand'
    };
  }
  return { shouldAlert: false };
}

/**
 * Check for big play potential (3rd and long, etc.)
 */
function checkBigPlayPotential(gs) {
  if (gs.down === 3 && gs.distance >= 10) {
    return {
      shouldAlert: gs.distance >= 15,
      reasons: [`Big play needed: 3rd & ${gs.distance}`],
      priority: 75,
      probability: 0.30,
      severity: 'LOW',
      alertType: 'bigPlayPotential'
    };
  }
  return { shouldAlert: false };
}

/**
 * L1 check: Basic scoring opportunities - DISABLED
 */
function ncaafL1Alert(gs) {
  // DISABLED: All NCAAF L1 alerts disabled
  return { yes: false, reason: 'NCAAF L1 alerts disabled' };
}

/**
 * L2 check: High-impact situations - DISABLED
 */
function ncaafL2Alert(gs) {
  // DISABLED: All NCAAF L2 alerts disabled
  return { yes: false, reason: 'NCAAF L2 alerts disabled' };
}

/**
 * L3 check: Critical situations only - DISABLED
 */
function ncaafL3Alert(gs) {
  // DISABLED: All NCAAF L3 alerts disabled
  return { yes: false, reason: 'NCAAF L3 alerts disabled' };
}

/**
 * Comprehensive NCAAF alert checker - DISABLED
 */
function checkNCAAFAlerts(gs) {
  // DISABLED: NCAAF alert module completely disabled
  return { 
    shouldAlert: false,
    reasons: ['NCAAF alerts disabled'],
    priority: 0,
    probability: 0,
    severity: 'NONE'
  };
}

// Export functions using CommonJS for compatibility with existing system
module.exports = {
  calcNCAAFScoringAlert: calcNCAAFScoringAlert,
  checkNCAAFAlerts: checkNCAAFAlerts,
  checkRedZone: checkRedZone,
  checkFourthDown: checkFourthDown,
  checkTwoMinuteWarning: checkTwoMinuteWarning,
  checkCloseGame: checkCloseGame,
  checkOvertime: checkOvertime,
  checkGoalLineStand: checkGoalLineStand,
  checkBigPlayPotential: checkBigPlayPotential,
  ncaafL1Alert: ncaafL1Alert,
  ncaafL2Alert: ncaafL2Alert,
  ncaafL3Alert: ncaafL3Alert
};