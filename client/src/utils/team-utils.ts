// ─── Shared Team & Time Utilities ────────────────────────────────
// Consolidated from dashboard.tsx, alerts.tsx, and calendar.tsx

const TEAM_ABBR: Record<string, string> = {
  // MLB
  'New York Yankees': 'NYY', 'Boston Red Sox': 'BOS', 'Los Angeles Dodgers': 'LAD',
  'San Francisco Giants': 'SFG', 'Houston Astros': 'HOU', 'Texas Rangers': 'TEX',
  'Chicago Cubs': 'CHC', 'St. Louis Cardinals': 'STL', 'Atlanta Braves': 'ATL',
  'Philadelphia Phillies': 'PHI', 'San Diego Padres': 'SD', 'Los Angeles Angels': 'LAA',
  'Seattle Mariners': 'SEA', 'Toronto Blue Jays': 'TOR', 'Tampa Bay Rays': 'TB',
  'Baltimore Orioles': 'BAL', 'Minnesota Twins': 'MIN', 'Cleveland Guardians': 'CLE',
  'Detroit Tigers': 'DET', 'Chicago White Sox': 'CWS', 'Kansas City Royals': 'KC',
  'Milwaukee Brewers': 'MIL', 'Pittsburgh Pirates': 'PIT', 'Cincinnati Reds': 'CIN',
  'Arizona Diamondbacks': 'ARI', 'Colorado Rockies': 'COL', 'Miami Marlins': 'MIA',
  'Washington Nationals': 'WSH', 'New York Mets': 'NYM', 'Oakland Athletics': 'OAK',
  // NBA
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
  // NFL
  'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL', 'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI', 'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL', 'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET', 'Green Bay Packers': 'GB', 'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX', 'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC', 'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN', 'New England Patriots': 'NE',
  'New Orleans Saints': 'NO', 'New York Giants': 'NYG', 'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT', 'Seattle Seahawks': 'SEA',
  'San Francisco 49ers': 'SF', 'Tampa Bay Buccaneers': 'TB', 'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
  // NHL
  'Anaheim Ducks': 'ANA', 'Arizona Coyotes': 'ARI', 'Boston Bruins': 'BOS',
  'Buffalo Sabres': 'BUF', 'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR',
  'Chicago Blackhawks': 'CHI', 'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ',
  'Dallas Stars': 'DAL', 'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM',
  'Florida Panthers': 'FLA', 'Los Angeles Kings': 'LAK', 'Minnesota Wild': 'MIN',
  'Montreal Canadiens': 'MTL', 'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJD',
  'New York Islanders': 'NYI', 'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT',
  'Philadelphia Flyers': 'PHI', 'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJS',
  'Seattle Kraken': 'SEA', 'St. Louis Blues': 'STL', 'Tampa Bay Lightning': 'TBL',
  'Toronto Maple Leafs': 'TOR', 'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK',
  'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG',
};

// Nickname-only fallback (e.g. "Yankees" → "NYY")
const NICKNAME_ABBR: Record<string, string> = {
  'Yankees': 'NYY', 'Mets': 'NYM', 'Dodgers': 'LAD', 'Angels': 'LAA',
  'Athletics': 'OAK', 'Padres': 'SD', 'Cubs': 'CHC', 'White Sox': 'CWS',
  'Guardians': 'CLE', 'Twins': 'MIN', 'Royals': 'KC', 'Astros': 'HOU',
  'Rangers': 'TEX', 'Mariners': 'SEA', 'Red Sox': 'BOS', 'Orioles': 'BAL',
  'Blue Jays': 'TOR', 'Rays': 'TB', 'Marlins': 'MIA', 'Nationals': 'WSH',
  'Phillies': 'PHI', 'Pirates': 'PIT', 'Reds': 'CIN', 'Brewers': 'MIL',
  'Diamondbacks': 'ARI', 'Rockies': 'COL', 'Cardinals': 'STL', 'Braves': 'ATL',
  'Giants': 'SF', 'Tigers': 'DET',
  'Hawks': 'ATL', 'Celtics': 'BOS', 'Nets': 'BKN', 'Hornets': 'CHA',
  'Bulls': 'CHI', 'Cavaliers': 'CLE', 'Mavericks': 'DAL', 'Nuggets': 'DEN',
  'Pistons': 'DET', 'Warriors': 'GSW', 'Rockets': 'HOU', 'Pacers': 'IND',
  'Clippers': 'LAC', 'Lakers': 'LAL', 'Grizzlies': 'MEM', 'Heat': 'MIA',
  'Bucks': 'MIL', 'Timberwolves': 'MIN', 'Pelicans': 'NOP', 'Knicks': 'NYK',
  'Thunder': 'OKC', 'Magic': 'ORL', '76ers': 'PHI', 'Suns': 'PHX',
  'Trail Blazers': 'POR', 'Blazers': 'POR', 'Kings': 'SAC', 'Spurs': 'SAS',
  'Raptors': 'TOR', 'Jazz': 'UTA', 'Wizards': 'WAS',
  'Falcons': 'ATL', 'Ravens': 'BAL', 'Bills': 'BUF', 'Panthers': 'CAR',
  'Bears': 'CHI', 'Bengals': 'CIN', 'Browns': 'CLE', 'Cowboys': 'DAL',
  'Broncos': 'DEN', 'Lions': 'DET', 'Packers': 'GB', 'Texans': 'HOU',
  'Colts': 'IND', 'Jaguars': 'JAX', 'Chiefs': 'KC', 'Chargers': 'LAC',
  'Rams': 'LAR', 'Raiders': 'LV', 'Dolphins': 'MIA', 'Vikings': 'MIN',
  'Patriots': 'NE', 'Saints': 'NO', 'Jets': 'NYJ', 'Eagles': 'PHI',
  'Steelers': 'PIT', 'Seahawks': 'SEA', '49ers': 'SF', 'Niners': 'SF',
  'Buccaneers': 'TB', 'Bucs': 'TB', 'Titans': 'TEN', 'Commanders': 'WAS',
};

/**
 * Get team abbreviation from full name, nickname, or object.
 * Handles: "New York Yankees", "Yankees", { name: "New York Yankees" }, { abbreviation: "NYY" }
 */
export function getTeamAbbr(team: string | { name: string; abbreviation?: string } | undefined): string {
  if (!team) return '???';
  if (typeof team === 'object') {
    if (team.abbreviation) return team.abbreviation;
    return getTeamAbbr(team.name);
  }
  // Check full name first
  if (TEAM_ABBR[team]) return TEAM_ABBR[team];
  // Check nickname
  const lastWord = team.split(' ').pop() || '';
  // Try multi-word nicknames first (e.g. "Red Sox", "Blue Jays", "White Sox", "Trail Blazers")
  const words = team.split(' ');
  if (words.length >= 2) {
    const twoWord = words.slice(-2).join(' ');
    if (NICKNAME_ABBR[twoWord]) return NICKNAME_ABBR[twoWord];
  }
  if (NICKNAME_ABBR[lastWord]) return NICKNAME_ABBR[lastWord];
  // Fallback: first 3 chars of last word
  return lastWord.slice(0, 3).toUpperCase() || '???';
}

/**
 * Extract team display name from string or object.
 */
export function getTeamName(team: string | { name: string } | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'object' ? team.name : team;
}

/**
 * Remove city prefix, returning just the nickname (e.g. "New York Yankees" → "Yankees").
 */
export function getTeamNickname(teamName: string): string {
  if (!teamName) return '';
  const words = teamName.split(' ');
  return words.length > 1 ? words[words.length - 1] : teamName;
}

/**
 * Format time elapsed since a timestamp.
 * Returns uppercase terminal-style: "NOW", "5M AGO", "2H AGO", "1D AGO"
 */
export function timeAgo(timestamp: string): string {
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'NOW';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}M AGO`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}H AGO`;
    return `${Math.floor(hrs / 24)}D AGO`;
  } catch {
    return '';
  }
}

/**
 * Sport accent colors for pills, borders, and badges.
 */
export function getSportAccent(sport: string) {
  switch (sport) {
    case 'MLB': return { bar: '#22C55E', pill: 'bg-emeraldGreen text-white shadow-sm shadow-emeraldGreen/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NBA': return { bar: '#A855F7', pill: 'bg-purple-500 text-white shadow-sm shadow-purple-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NFL': return { bar: '#F97316', pill: 'bg-orange-500 text-white shadow-sm shadow-orange-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NHL': return { bar: '#06B6D4', pill: 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NCAAF': return { bar: '#3B82F6', pill: 'bg-blue-500 text-white shadow-sm shadow-blue-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'CFL': return { bar: '#EF4444', pill: 'bg-red-500 text-white shadow-sm shadow-red-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'WNBA': return { bar: '#EC4899', pill: 'bg-pink-500 text-white shadow-sm shadow-pink-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    default: return { bar: '#22C55E', pill: 'bg-emeraldGreen text-white shadow-sm shadow-emeraldGreen/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
  }
}
