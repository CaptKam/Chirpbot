/**
 * Clean Alert Formatter (Client-side version)
 * Structure: [Icon + ShortType] | [State] | [Action/Why]
 * Primary/secondary lines each ≤ 15 words.
 */

export interface CleanAlertInput {
  type: string;
  sport: string;
  context?: any;
  timing?: { whyNow?: string; urgencyLevel?: string };
  action?: { primaryAction?: string; confidence?: number };
  insight?: { keyFactor?: string };
  riskReward?: { probability?: number };
  gameState?: any;
  message?: string;
  headline?: string;
}

export interface CleanAlertOutput {
  primary: string;
  secondary?: string;
  icon: string;
  confidence?: number;
}

export class CleanAlertFormatter {
  private readonly WORD_LIMIT_PRIMARY = 15;
  private readonly WORD_LIMIT_SECONDARY = 15;

  private readonly sportIcons: Record<string, string> = {
    MLB: '⚾', NFL: '🏈', NBA: '🏀', WNBA: '🏀', NCAAF: '🏈', CFL: '🍁', NHL: '🏒'
  };

  private readonly actionIcons: Record<string, string> = {
    OVER: '📈', UNDER: '📉', BET: '💡', WATCH: '👀', ALERT: '🔔', HOT: '🔥', COLD: '❄️'
  };

  // ===== Public API =====
  format(alert: CleanAlertInput): CleanAlertOutput {
    const sport = (alert.sport || '').toUpperCase() || 'GAME';
    switch (sport) {
      case 'MLB':  return this.formatMLB(alert);
      case 'NFL':  return this.formatNFL(alert);
      case 'NBA':  return this.formatNBA(alert);
      case 'WNBA': return this.formatWNBA(alert);
      case 'NCAAF':return this.formatNCAAF(alert);
      case 'CFL':  return this.formatCFL(alert);
      default:     return this.formatGeneric(alert);
    }
  }

  // ===== MLB =====
  private formatMLB(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gs = alert.gameState || alert.context || {};
    const icon = this.iconFor('MLB');
    const conf = this.getProbability(alert);
    const sev = this.severityBadge(conf);
    const inning = this.inningHalf(gs); // e.g. "T7"
    const outs = this.outsToken(gs.outs);
    const runners = this.runnersToken(gs);

    const shortType = this.shortType(type);
    const baseState = this.compose(
      `${icon} ${shortType}`, // Icon + Type
      [inning, outs, runners].filter(Boolean).join(' • ') // compact state
    );

    // Type-specific tweaks
    if (type.includes('BASES_LOADED')) {
      return this.output(baseState, this.actionLine(alert, 'OVER 0.5 runs', sev), icon, conf);
    }
    if (type.includes('LATE_INNING_CLOSE')) {
      const diff = Math.abs((gs.homeScore ?? 0) - (gs.awayScore ?? 0));
      const state = this.compose(`${icon} ${shortType}`, [inning, `${diff} run game`].join(' • '));
      return this.output(state, this.actionLine(alert, 'High leverage', sev), icon, conf);
    }
    if (type.includes('PITCHING_CHANGE')) {
      const state = this.compose(`${icon} ${shortType}`, inning);
      return this.output(state, this.actionLine(alert, 'Watch new arm', sev), icon, conf);
    }
    if (type.includes('GAME_START')) {
      const state = this.compose(`${icon} ${shortType}`, 'Top 1 • First pitch');
      return this.output(state, this.actionLine(alert, 'Opening lines live', sev), icon, conf);
    }

    // Default MLB
    const state = this.compose(`${icon} ${shortType}`, [inning, outs, runners].filter(Boolean).join(' • '));
    return this.output(state, this.actionLine(alert, undefined, sev), icon, conf);
  }

  // ===== NFL / Football family =====
  private formatNFL(alert: CleanAlertInput): CleanAlertOutput {
    const icon = this.iconFor('NFL');
    return this.footballLike(alert, icon);
  }
  private formatNCAAF(alert: CleanAlertInput): CleanAlertOutput {
    const icon = this.iconFor('NCAAF');
    return this.footballLike(alert, icon);
  }
  private formatCFL(alert: CleanAlertInput): CleanAlertOutput {
    const icon = this.iconFor('CFL');
    const out = this.footballLike(alert, icon);
    out.icon = icon;
    out.primary = out.primary.replace(/^🏈/, '🍁'); // visual tweak if reused
    return out;
  }
  private footballLike(alert: CleanAlertInput, icon: string): CleanAlertOutput {
    const type = alert.type || '';
    const gs = alert.gameState || alert.context || {};
    const conf = this.getProbability(alert);
    const sev = this.severityBadge(conf);

    const q = this.quarterToken(gs);
    const t = gs.timeRemaining || '';
    const downDist = this.downDistance(gs);
    const field = this.fieldPos(gs);

    const shortType = this.shortType(type);
    const stateTokens = [q, t, downDist, field].filter(Boolean).join(' • ');
    const baseState = this.compose(`${icon} ${shortType}`, stateTokens);

    if (type.includes('RED_ZONE')) {
      return this.output(baseState, this.actionLine(alert, 'TD chance', sev), icon, conf);
    }
    if (type.includes('TWO_MINUTE_WARNING')) {
      return this.output(baseState, this.actionLine(alert, 'Pace spike', sev), icon, conf);
    }
    if (type.includes('FOURTH_DOWN')) {
      return this.output(baseState, this.actionLine(alert, 'Decision point', sev), icon, conf);
    }
    if (type.includes('GAME_START')) {
      const p = this.compose(`${icon} ${shortType}`, [q || 'Q1', 'Kickoff'].join(' • '));
      return this.output(p, this.actionLine(alert, 'Opening drive', sev), icon, conf);
    }
    if (type.includes('SECOND_HALF')) {
      const p = this.compose(`${icon} ${shortType}`, ['Q3', 'Kickoff'].join(' • '));
      return this.output(p, this.actionLine(alert, 'Halftime adj live', sev), icon, conf);
    }
    return this.output(baseState, this.actionLine(alert, undefined, sev), icon, conf);
  }

  // ===== NBA / WNBA =====
  private formatNBA(alert: CleanAlertInput): CleanAlertOutput {
    return this.basketballLike(alert, this.iconFor('NBA'));
  }
  private formatWNBA(alert: CleanAlertInput): CleanAlertOutput {
    return this.basketballLike(alert, this.iconFor('WNBA'));
  }
  private basketballLike(alert: CleanAlertInput, icon: string): CleanAlertOutput {
    const type = alert.type || '';
    const gs = alert.gameState || alert.context || {};
    const conf = this.getProbability(alert);
    const sev = this.severityBadge(conf);

    const q = this.hoopQuarterToken(gs);
    const t = gs.timeRemaining || '';
    const diff = Math.abs((gs.homeScore ?? 0) - (gs.awayScore ?? 0));
    const shortType = this.shortType(type);

    const baseState = this.compose(`${icon} ${shortType}`, [q, t, diff ? `${diff} pt` : ''].filter(Boolean).join(' • '));

    if (type.includes('FINAL_MINUTES') || (q === 'Q4' && t && this.parseClockSec(t) <= 120)) {
      return this.output(baseState, this.actionLine(alert, diff <= 5 ? 'Clutch time' : 'Late game', sev), icon, conf);
    }
    if (type.includes('OVERTIME')) {
      const p = this.compose(`${icon} ${shortType}`, ['OT', t || ''].filter(Boolean).join(' • '));
      return this.output(p, this.actionLine(alert, 'High variance', sev), icon, conf);
    }
    if (type.includes('FOURTH_QUARTER')) {
      const p = this.compose(`${icon} ${shortType}`, ['Q4', t || ''].filter(Boolean).join(' • '));
      return this.output(p, this.actionLine(alert, 'Run potential', sev), icon, conf);
    }
    return this.output(baseState, this.actionLine(alert, undefined, sev), icon, conf);
  }

  // ===== Generic =====
  private formatGeneric(alert: CleanAlertInput): CleanAlertOutput {
    const icon = '🔔';
    const shortType = this.shortType(alert.type || 'Alert');
    const primary = this.compose(`${icon} ${shortType}`, alert.headline || alert.message || '');
    const conf = this.getProbability(alert);
    const secondary = this.actionLine(alert, undefined, this.severityBadge(conf));
    return this.output(primary, secondary, icon, conf);
  }

  // ===== Helpers: tokens / composition =====
  private compose(head: string, state: string): string {
    // Compose with " | " and enforce word limit.
    const text = [head, state].filter(Boolean).join(' | ').trim();
    return this.limitWords(text, this.WORD_LIMIT_PRIMARY);
  }

  private actionLine(alert: CleanAlertInput, defaultAction?: string, sev?: string): string | undefined {
    const conf = this.getProbability(alert);
    const chosen = alert.action?.primaryAction || defaultAction || alert.insight?.keyFactor || alert.timing?.whyNow;
    if (!chosen && !conf && !sev) return undefined;

    const hintParts = [
      sev,                                    // e.g., 🔥 high / 👀 watch
      chosen ? this.capitalize(chosen) : '',  // e.g., "High leverage"
      conf ? `${Math.round(conf)}%` : ''      // e.g., "82%"
    ].filter(Boolean);

    const line = hintParts.join(' • ');
    return line ? this.limitWords(line, this.WORD_LIMIT_SECONDARY) : undefined;
  }

  private limitWords(s: string, maxWords: number): string {
    if (!s) return '';
    const words = s.split(/\s+/);
    if (words.length <= maxWords) return s;
    return words.slice(0, maxWords).join(' ') + ' …';
  }

  private shortType(type: string): string {
    return (type || 'Alert')
      .replace(/^(MLB|NFL|NBA|WNBA|NCAAF|CFL|NHL)_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase())
      .slice(0, 24);
  }

  private iconFor(sport: string): string {
    return this.sportIcons[sport] || '🔔';
  }

  private getProbability(alert: CleanAlertInput): number {
    const from = alert.riskReward?.probability ?? alert.action?.confidence ?? alert.context?.probability ?? 0;
    return Math.max(0, Math.min(100, Math.round(from)));
  }

  private severityBadge(prob: number): string | undefined {
    if (!prob) return undefined;
    if (prob >= 85) return '🔥 high';
    if (prob >= 60) return '👀 watch';
    return 'ℹ️ info';
  }

  private inningHalf(gs: any): string {
    const inn = gs.inning ?? 0;
    if (!inn) return '';
    const half = gs.inningState ? (gs.inningState === 'top' ? 'T' : 'B')
               : gs.isTopInning !== undefined ? (gs.isTopInning ? 'T' : 'B')
               : '';
    return `${half}${inn}`.trim();
  }

  private outsToken(outs: any): string {
    if (outs === undefined || outs === null) return '';
    const n = Number(outs) || 0;
    return `${n} ${n === 1 ? 'out' : 'out' + 's'}`; // simple plural
  }

  private runnersToken(gs: any): string {
    const r = gs.runners ?? {
      first: !!gs.hasFirst, second: !!gs.hasSecond, third: !!gs.hasThird
    };
    const pos: string[] = [];
    if (r?.first) pos.push('1B');
    if (r?.second) pos.push('2B');
    if (r?.third) pos.push('3B');
    if (!pos.length) return '';
    return pos.join(',');
  }

  private quarterToken(gs: any): string {
    const q = gs.quarter ?? 0;
    return q ? `Q${q}` : '';
  }

  private hoopQuarterToken(gs: any): string {
    const q = gs.quarter ?? 0;
    if (!q) return '';
    return q <= 4 ? `Q${q}` : `OT${q - 4}`;
  }

  private parseClockSec(clock?: string): number {
    if (!clock) return NaN;
    const token = clock.trim().split(' ')[0];
    const [m, s] = token.split(':').map(v => parseInt(v, 10));
    if (Number.isNaN(m) || Number.isNaN(s)) return NaN;
    return m * 60 + s;
  }

  private downDistance(gs: any): string {
    if (!gs.down || !gs.yardsToGo) return '';
    return `${gs.down}${this.ordinal(gs.down)} & ${gs.yardsToGo}`;
  }

  private fieldPos(gs: any): string {
    if (gs.fieldPosition === undefined || gs.fieldPosition === null) return '';
    return `${gs.fieldPosition} yd line`;
  }

  private ordinal(n: number): string {
    const r = n % 100;
    if (r >= 11 && r <= 13) return 'th';
    switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
  }

  private capitalize(s?: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private output(primary: string, secondary?: string, icon?: string, confidence?: number): CleanAlertOutput {
    return {
      primary,
      secondary,
      icon: icon || '🔔',
      confidence
    };
  }
}

export const cleanAlertFormatter = new CleanAlertFormatter();
