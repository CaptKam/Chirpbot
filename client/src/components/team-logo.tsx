import React from 'react';

interface TeamLogoProps {
  teamName: string;
  abbreviation?: string;
  sport?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Team name to abbreviation mapping for when API doesn't provide abbreviations
const teamNameToAbbr: Record<string, string> = {
  // MLB Teams
  'Los Angeles Dodgers': 'LAD',
  'San Francisco Giants': 'SF', 
  'New York Yankees': 'NYY',
  'Boston Red Sox': 'BOS',
  'Chicago Cubs': 'CHC',
  'Milwaukee Brewers': 'MIL',
  'Detroit Tigers': 'DET',
  'Houston Astros': 'HOU',
  'Pittsburgh Pirates': 'PIT',
  'Toronto Blue Jays': 'TOR',
  'Miami Marlins': 'MIA',
  'St. Louis Cardinals': 'STL',
  'Philadelphia Phillies': 'PHI',
  'Seattle Mariners': 'SEA',
  'Baltimore Orioles': 'BAL',
  'Atlanta Braves': 'ATL',
  'Chicago White Sox': 'CWS',
  'Kansas City Royals': 'KC',
  'Texas Rangers': 'TEX',
  'Colorado Rockies': 'COL',
  'Los Angeles Angels': 'LAA',
  'Cincinnati Reds': 'CIN',
  'Arizona Diamondbacks': 'ARI',
  'Cleveland Guardians': 'CLE',
  'San Diego Padres': 'SD',
  'New York Mets': 'NYM',
  'Washington Nationals': 'WSH',
  'Nationals': 'WSH',
  'Athletics': 'OAK',
  'Oakland Athletics': 'OAK',
  'Minnesota Twins': 'MIN',
  'Tampa Bay Rays': 'TB',

  // Common shortened names that MLB API might return
  'Dodgers': 'LAD',
  'Giants': 'SF',
  'Yankees': 'NYY',
  'Red Sox': 'BOS',
  'Cubs': 'CHC',
  'Brewers': 'MIL',
  'Tigers': 'DET',
  'Astros': 'HOU',
  'Pirates': 'PIT',
  'Blue Jays': 'TOR',
  'Marlins': 'MIA',
  'Cardinals': 'STL',
  'Phillies': 'PHI',
  'Mariners': 'SEA',
  'Orioles': 'BAL',
  'Braves': 'ATL',
  'White Sox': 'CWS',
  'Royals': 'KC',
  'Rangers': 'TEX',
  'Rockies': 'COL',
  'Angels': 'LAA',
  'Reds': 'CIN',
  'Guardians': 'CLE',
  'Mets': 'NYM',
  'Twins': 'MIN',
  'Rays': 'TB',

  // NFL Teams
  'Kansas City Chiefs': 'KC',
  'Buffalo Bills': 'BUF',
  'New York Jets': 'NYJ',
  'New England Patriots': 'NE',
  'Miami Dolphins': 'MIA',
  'Pittsburgh Steelers': 'PIT',
  'Baltimore Ravens': 'BAL',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Tennessee Titans': 'TEN',
  'Denver Broncos': 'DEN',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Dallas Cowboys': 'DAL',
  'Philadelphia Eagles': 'PHI',
  'Atlanta Falcons': 'ATL',
  'Chicago Bears': 'CHI',
  'Minnesota Vikings': 'MIN',

  // NBA Teams  
  'Los Angeles Lakers': 'LAL',
  'Boston Celtics': 'CEL',
  'Golden State Warriors': 'GSW',
  'Chicago Bulls': 'CHI',
  'Miami Heat': 'MIA',
  'New York Knicks': 'NYK',
  'Brooklyn Nets': 'BKN',
  'Philadelphia 76ers': 'PHI',

  // NHL Teams
  'Los Angeles Kings': 'LAK',
  'Anaheim Ducks': 'ANA',
  'Vegas Golden Knights': 'VGK',
  'Colorado Avalanche': 'COL',
  'Dallas Stars': 'DAL',
  'Nashville Predators': 'NSH',

  // WNBA Teams - Full Names (using unique abbreviations to avoid conflicts)
  'Phoenix Mercury': 'PHO',
  'Washington Mystics': 'WAS',
  'Golden State Valkyries': 'GSV',
  'Las Vegas Aces': 'LAS',
  'Chicago Sky': 'CHIS',
  'Connecticut Sun': 'CON',
  'Indiana Fever': 'IND',
  'New York Liberty': 'NYL',
  'Minnesota Lynx': 'MINL',
  'Seattle Storm': 'SEAS',
  'Dallas Wings': 'DALW',
  'Atlanta Dream': 'ATLD',
  
  // WNBA Teams - Short Names (what the API returns)
  'Mercury': 'PHO',
  'Mystics': 'WAS',
  'MYS': 'WAS', // Alternative abbreviation
  'Valkyries': 'GSV',
  'GOL': 'GSV', // Alternative abbreviation
  'Aces': 'LAS',
  'LV': 'LAS', // Alternative abbreviation
  'Sky': 'CHIS',
  'Sun': 'CON',
  'Fever': 'IND',
  'Liberty': 'NYL',
  'Lynx': 'MINL',
  'Storm': 'SEAS',
  'Wings': 'DALW',
  'Dream': 'ATLD'
};

// ESPN team logo URLs - these return actual mascot logos
const getTeamLogoUrl = (teamAbbr: string, sport?: string): string | null => {
  // ESPN logo URLs by sport
  const espnLogos: Record<string, Record<string, string>> = {
    MLB: {
      'LAD': 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
      'SF': 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png',
      'NYY': 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
      'BOS': 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
      'CHC': 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
      'MIL': 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png',
      'DET': 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png',
      'HOU': 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
      'PIT': 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png',
      'TOR': 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
      'MIA': 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png',
      'STL': 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png',
      'PHI': 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png',
      'SEA': 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png',
      'BAL': 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png',
      'ATL': 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
      'CWS': 'https://a.espncdn.com/i/teamlogos/mlb/500/chw.png',
      'KC': 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png',
      'TEX': 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
      'COL': 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png',
      'LAA': 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png',
      'CIN': 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png',
      'AZ': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
      'ARI': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
      'CLE': 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png',
      'SD': 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
      'NYM': 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png',
      'WSH': 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png',
      'OAK': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
      'ATH': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
      'MIN': 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png',
      'TB': 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
    },
    NFL: {
      'NYJ': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'PHI': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'DAL': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'ATL': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'TEN': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'MIN': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'KC': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'CHI': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'BUF': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'NE': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'MIA': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'PIT': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'BAL': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'CIN': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'CLE': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'HOU': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'IND': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'JAX': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'DEN': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'LV': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'LAC': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    },
    WNBA: {
      'PHO': 'https://content.sportslogos.net/logos/34/875/full/phoenix_mercury_logo_primary_20142024.png',
      'WAS': 'https://content.sportslogos.net/logos/34/883/full/washington_mystics_logo_primary_20142024.png',
      'GSV': 'https://content.sportslogos.net/logos/34/12102/full/golden_state_valkyries_logo_primary_20242025.png',
      'LV': 'https://content.sportslogos.net/logos/34/7024/full/las_vegas_aces_logo_primary_20172024.png',
      'CHIS': 'https://content.sportslogos.net/logos/34/874/full/chicago_sky_logo_primary_20142024.png',
      'CON': 'https://content.sportslogos.net/logos/34/878/full/connecticut_sun_logo_primary_20142024.png',
      'IND': 'https://content.sportslogos.net/logos/34/877/full/indiana_fever_logo_primary_20142024.png',
      'NYL': 'https://content.sportslogos.net/logos/34/882/full/new_york_liberty_logo_primary_20142024.png',
      'MINL': 'https://content.sportslogos.net/logos/34/881/full/minnesota_lynx_logo_primary_20142024.png',
      'SEAS': 'https://content.sportslogos.net/logos/34/884/full/seattle_storm_logo_primary_20142024.png',
      'DALW': 'https://content.sportslogos.net/logos/34/879/full/dallas_wings_logo_primary_20142024.png',
      'ATLD': 'https://content.sportslogos.net/logos/34/876/full/atlanta_dream_logo_primary_20142024.png'
    }
  };

  // If sport is specified, try that sport first
  if (sport && espnLogos[sport] && espnLogos[sport][teamAbbr]) {
    return espnLogos[sport][teamAbbr];
  }

  // Fallback: try to find logo in any sport (for backwards compatibility)
  for (const [sportKey, logos] of Object.entries(espnLogos)) {
    if (logos[teamAbbr]) {
      return logos[teamAbbr];
    }
  }

  return null;
};

export function TeamLogo({ teamName, abbreviation, sport, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const dimensions = sizeClasses[size];

  // Handle fallback cases
  if (!teamName && !abbreviation) {
    return (
      <div className={`${dimensions} rounded-full bg-slate-700 flex items-center justify-center ${className}`}>
        <span className="text-slate-400 text-xs font-bold">TBD</span>
      </div>
    );
  }

  if (teamName === 'TBD' || abbreviation === 'TBD') {
    return (
      <div className={`${dimensions} rounded-full bg-slate-700 flex items-center justify-center ${className}`}>
        <span className="text-slate-400 text-xs font-bold">TBD</span>
      </div>
    );
  }


  const logoMap: Record<string, JSX.Element> = {
    // MLB Teams
    'LAD': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#005A9C" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-2xl font-sans">LA</text>
      </svg>
    ),
    'SF': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FD5A1E" stroke="#000000" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-black font-black text-2xl font-sans">SF</text>
      </svg>
    ),
    'NYY': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#132448" stroke="#C4CED4" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">NY</text>
      </svg>
    ),
    'BOS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#BD3039" stroke="#FFFFFF" strokeWidth="2"/>
        <circle cx="50" cy="50" r="20" fill="none" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-2xl font-sans">B</text>
      </svg>
    ),
    'CHC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0E3386" stroke="#CC3433" strokeWidth="3"/>
        <circle cx="50" cy="50" r="35" fill="none" stroke="#CC3433" strokeWidth="1"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">CHC</text>
      </svg>
    ),
    'MIL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FFC52F" stroke="#12284B" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-blue-900 font-black text-xl font-sans">M</text>
      </svg>
    ),
    'DET': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0C2340" stroke="#FA4616" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">DET</text>
      </svg>
    ),
    'HOU': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002D62" stroke="#EB6E1F" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-orange-400 font-black text-base font-sans">HOU</text>
      </svg>
    ),
    'PIT': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FDB827" stroke="#27251F" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-black font-black text-base font-sans">PIT</text>
      </svg>
    ),
    'TOR': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#134A8E" stroke="#1D2D5C" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">TOR</text>
      </svg>
    ),
    'STL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#C41E3A" stroke="#FEDB00" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">STL</text>
      </svg>
    ),
    'SEA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0C2C56" stroke="#005C5C" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-teal-400 font-black text-base font-sans">SEA</text>
      </svg>
    ),
    'BAL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#DF4601" stroke="#000000" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">BAL</text>
      </svg>
    ),
    'ATL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#CE1141" stroke="#13274F" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">ATL</text>
      </svg>
    ),
    'CWS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#27251F" stroke="#C4CED4" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">CWS</text>
      </svg>
    ),
    'TEX': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#003278" stroke="#C0111F" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-red-400 font-black text-base font-sans">TEX</text>
      </svg>
    ),
    'COL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#33006F" stroke="#C4CED4" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">COL</text>
      </svg>
    ),
    'LAA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#BA0021" stroke="#003263" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">LAA</text>
      </svg>
    ),
    'CIN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#C6011F" stroke="#000000" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">CIN</text>
      </svg>
    ),
    'AZ': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#A71930" stroke="#E3D4AD" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">AZ</text>
      </svg>
    ),
    'CLE': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#E31937" stroke="#002B5C" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">CLE</text>
      </svg>
    ),
    'SD': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#2F241D" stroke="#FFC425" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-yellow-400 font-black text-xl font-sans">SD</text>
      </svg>
    ),

    // NFL Teams
    'KC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#E31837" stroke="#FFB81C" strokeWidth="4"/>
        <polygon points="35,35 65,35 50,65" fill="#FFB81C"/>
        <text x="50" y="40" textAnchor="middle" className="fill-white font-black text-sm font-sans">KC</text>
      </svg>
    ),
    'BUF': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#00338D" stroke="#C60C30" strokeWidth="3"/>
        <circle cx="40" cy="40" r="8" fill="#C60C30"/>
        <text x="50" y="65" textAnchor="middle" className="fill-white font-black text-sm font-sans">BILLS</text>
      </svg>
    ),
    'NYJ': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#125740" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-lg font-sans">NYJ</text>
      </svg>
    ),
    'DAL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#041E42" stroke="#869397" strokeWidth="2"/>
        <polygon points="50,25 58,45 78,45 62,58 68,78 50,65 32,78 38,58 22,45 42,45" fill="#869397"/>
      </svg>
    ),
    'TEN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0C2340" stroke="#4B92DB" strokeWidth="3"/>
        <polygon points="30,45 50,25 70,45 60,45 60,70 40,70 40,45" fill="#4B92DB"/>
      </svg>
    ),
    'CHI': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0B162A" stroke="#C83803" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-orange-500 font-black text-2xl font-sans">C</text>
      </svg>
    ),
    'PHI': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#004C54" stroke="#A5ACAF" strokeWidth="2"/>
        <path d="M 30 50 Q 50 30 70 50 Q 50 70 30 50" fill="#A5ACAF"/>
      </svg>
    ),
    'NE': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002244" stroke="#C60C30" strokeWidth="3"/>
        <polygon points="25,50 50,25 75,50 50,75" fill="#C60C30"/>
      </svg>
    ),
    'MIA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#008E97" stroke="#FC4C02" strokeWidth="3"/>
        <ellipse cx="50" cy="50" rx="20" ry="15" fill="#FC4C02"/>
      </svg>
    ),
    'DEN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FB4F14" stroke="#002244" strokeWidth="3"/>
        <polygon points="30,40 70,40 60,60 40,60" fill="#002244"/>
      </svg>
    ),
    'LV': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#A5ACAF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-gray-400 font-black text-base font-sans">LV</text>
      </svg>
    ),
    'LAC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0080C6" stroke="#FFC20E" strokeWidth="3"/>
        <polygon points="30,50 50,20 70,50 50,30" fill="#FFC20E"/>
      </svg>
    ),
    'IND': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002C5F" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">IND</text>
      </svg>
    ),
    'JAX': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#006778" stroke="#D7A22A" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-yellow-400 font-black text-base font-sans">JAX</text>
      </svg>
    ),

    // NBA Teams  
    'LAL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#552583" stroke="#FDB927" strokeWidth="4"/>
        <rect x="20" y="40" width="60" height="20" fill="#FDB927" rx="4"/>
        <text x="50" y="55" textAnchor="middle" className="fill-purple-900 font-black text-sm font-sans">LAKERS</text>
      </svg>
    ),
    'CEL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#007A33" stroke="#BA9653" strokeWidth="3"/>
        <circle cx="50" cy="45" r="12" fill="none" stroke="#BA9653" strokeWidth="2"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">CELTICS</text>
      </svg>
    ),

    // NHL Teams
    'LAK': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#111111" stroke="#A2AAAD" strokeWidth="2"/>
        <polygon points="30,30 70,30 60,50 40,50" fill="#A2AAAD"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">KINGS</text>
      </svg>
    ),
    'ANA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#F47A38" stroke="#B9975B" strokeWidth="3"/>
        <polygon points="25,45 75,45 50,25" fill="#B9975B"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">DUCKS</text>
      </svg>
    ),
    // WNBA Logos
    'PHO': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FDBB2D" stroke="#000000" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-black font-black text-xl font-sans">PHX</text>
      </svg>
    ),
    'WAS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#A71930" stroke="#000000" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">WAS</text>
      </svg>
    ),
    'GSV': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">GSV</text>
      </svg>
    ),
    'CHIS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">CHI</text>
      </svg>
    ),
    'CON': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002B5C" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">CON</text>
      </svg>
    ),
    'NYL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#4A2584" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">NYL</text>
      </svg>
    ),
    'MINL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">MIN</text>
      </svg>
    ),
    'SEAS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">SEA</text>
      </svg>
    ),
    'DALW': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">DAL</text>
      </svg>
    ),
    'ATLD': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">ATL</text>
      </svg>
    ),
    'NYM': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002D72" stroke="#FF5910" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">M</text>
      </svg>
    ),
    'WSH': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#AB0003" stroke="#14225A" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">W</text>
      </svg>
    ),
    'OAK': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#003831" stroke="#EFB21E" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-yellow-400 font-black text-xl font-sans">A</text>
      </svg>
    ),
    'ATH': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#003831" stroke="#EFB21E" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-yellow-400 font-black text-xl font-sans">A</text>
      </svg>
    ),
    'TB': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#092C5C" stroke="#8FBCE6" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">TB</text>
      </svg>
    )
  };

  // WNBA team logos mapping
  const wnbaLogos: Record<string, string> = {
    'PHO': '/logos/wnba/mercury.png',
    'PHX': '/logos/wnba/mercury.png',
    'PHOENIX': '/logos/wnba/mercury.png',
    'MERCURY': '/logos/wnba/mercury.png',

    'WAS': '/logos/wnba/mystics.png',
    'WASHINGTON': '/logos/wnba/mystics.png', 
    'MYSTICS': '/logos/wnba/mystics.png',
    'MYS': '/logos/wnba/mystics.png',

    'GS': '/logos/wnba/valkyries.png',
    'GSV': '/logos/wnba/valkyries.png',
    'GOLDEN STATE': '/logos/wnba/valkyries.png',
    'VALKYRIES': '/logos/wnba/valkyries.png',
    'GOL': '/logos/wnba/valkyries.png',

    'LV': '/logos/wnba/aces.png',
    'LAS': '/logos/wnba/aces.png',
    'LAS VEGAS': '/logos/wnba/aces.png',
    'ACES': '/logos/wnba/aces.png',

    'NYL': '/logos/wnba/liberty.png',
    'NEW YORK': '/logos/wnba/liberty.png',
    'LIBERTY': '/logos/wnba/liberty.png',

    'MINL': '/logos/wnba/lynx.png',
    'MINNESOTA': '/logos/wnba/lynx.png',
    'LYNX': '/logos/wnba/lynx.png',

    'SEAS': '/logos/wnba/storm.png',
    'SEATTLE': '/logos/wnba/storm.png',
    'STORM': '/logos/wnba/storm.png',

    'CHIS': '/logos/wnba/sky.png',
    'CHICAGO': '/logos/wnba/sky.png',
    'SKY': '/logos/wnba/sky.png',

    'CON': '/logos/wnba/sun.png',
    'CONNECTICUT': '/logos/wnba/sun.png',
    'SUN': '/logos/wnba/sun.png',

    'ATLD': '/logos/wnba/dream.png',
    'ATLANTA': '/logos/wnba/dream.png',
    'DREAM': '/logos/wnba/dream.png',

    'IND': '/logos/wnba/fever.png',
    'INDIANA': '/logos/wnba/fever.png',
    'FEVER': '/logos/wnba/fever.png',

    'DALW': '/logos/wnba/wings.png',
    'DALLAS': '/logos/wnba/wings.png',
    'WINGS': '/logos/wnba/wings.png'
  };


  // Get abbreviation from prop or lookup from team name
  let teamAbbr = abbreviation;

  if (!teamAbbr && teamName) {
    // First try direct match
    teamAbbr = teamNameToAbbr[teamName];

    // If no direct match, try partial matching
    if (!teamAbbr) {
      const partialMatch = Object.keys(teamNameToAbbr).find(fullName => 
        fullName.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(fullName.split(' ').pop()?.toLowerCase() || '')
      );
      if (partialMatch) {
        teamAbbr = teamNameToAbbr[partialMatch];
      }
    }
  }

  // Try to get the official team logo URL first, prioritizing the specified sport
  const logoUrl = teamAbbr ? getTeamLogoUrl(teamAbbr, sport) : null;

  if (logoUrl) {
    // Use official team logo from ESPN
    return (
      <img 
        src={logoUrl} 
        alt={teamName}
        className={`${sizeClasses[size]} ${className} object-contain`}
        onError={(e) => {
          // If image fails to load, hide it and show fallback
          console.log(`Failed to load logo for ${teamName}`);
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // Define team colors early for consistent reference
  const teamColors: Record<string, { primary: string; secondary: string; accent?: string }> = {
    // WNBA Team Colors (all using unique abbreviations)
    'PHO': { primary: '#E56020', secondary: '#000000', accent: '#FFFFFF' }, // Mercury Orange/Black
    'WAS': { primary: '#C8102E', secondary: '#002B5C', accent: '#FFFFFF' }, // Mystics Red/Navy
    'MYS': { primary: '#C8102E', secondary: '#002B5C', accent: '#FFFFFF' }, // Mystics Red/Navy (alt)
    'GSV': { primary: '#000000', secondary: '#FDB927', accent: '#FFFFFF' }, // Valkyries Black/Gold
    'GOL': { primary: '#000000', secondary: '#FDB927', accent: '#FFFFFF' }, // Valkyries Black/Gold (alt)
    'LAS': { primary: '#000000', secondary: '#C8102E', accent: '#FDB927' }, // Aces Black/Red/Gold
    'LV': { primary: '#000000', secondary: '#C8102E', accent: '#FDB927' },  // Aces Black/Red/Gold (alt)
    'CHIS': { primary: '#418FDE', secondary: '#FFC72C', accent: '#000000' }, // Sky Blue/Yellow
    'CON': { primary: '#E03A3E', secondary: '#041E42', accent: '#FFFFFF' },  // Sun Red/Navy
    'IND': { primary: '#002D62', secondary: '#FDBB30', accent: '#FFFFFF' },  // Fever Navy/Gold
    'NYL': { primary: '#86BC25', secondary: '#000000', accent: '#FFFFFF' },  // Liberty Green/Black
    'MINL': { primary: '#266092', secondary: '#FFC72C', accent: '#FFFFFF' }, // Lynx Blue/Gold
    'SEAS': { primary: '#2C5234', secondary: '#FFC72C', accent: '#FFFFFF' }, // Storm Green/Gold
    'DALW': { primary: '#C4D600', secondary: '#041E42', accent: '#FFFFFF' }, // Wings Lime/Navy
    'ATLD': { primary: '#C8102E', secondary: '#FFC72C', accent: '#000000' }, // Dream Red/Gold

    // NCAAF Team Colors (popular teams)
    'ALA': { primary: '#9E1B32', secondary: '#FFFFFF', accent: '#000000' }, // Alabama Crimson
    'GA': { primary: '#BA0C2F', secondary: '#000000', accent: '#FFFFFF' },  // Georgia Red/Black
    'OSU': { primary: '#BB0000', secondary: '#FFFFFF', accent: '#000000' }, // Ohio State Scarlet
    'TEX': { primary: '#BF5700', secondary: '#FFFFFF', accent: '#000000' }, // Texas Orange
    'ND': { primary: '#0C2340', secondary: '#C99700', accent: '#FFFFFF' },  // Notre Dame Navy/Gold
    'USC': { primary: '#990000', secondary: '#FFCC00', accent: '#FFFFFF' }, // USC Cardinal/Gold
    'MICH': { primary: '#00274C', secondary: '#FFCB05', accent: '#FFFFFF' }, // Michigan Navy/Maize
    'PSU': { primary: '#041E42', secondary: '#FFFFFF', accent: '#000000' }, // Penn State Navy
    'LSU': { primary: '#461D7C', secondary: '#FDD023', accent: '#FFFFFF' }, // LSU Purple/Gold
    'FLA': { primary: '#0021A5', secondary: '#FA4616', accent: '#FFFFFF' }, // Florida Blue/Orange

    // NBA Team Colors (add common ones)
    'LAL': { primary: '#552583', secondary: '#FDB927', accent: '#000000' }, // Lakers Purple/Gold
    'BOS': { primary: '#007A33', secondary: '#BA9653', accent: '#FFFFFF' }, // Celtics Green/Gold
    'GSW': { primary: '#1D428A', secondary: '#FFC72C', accent: '#FFFFFF' }, // Warriors Blue/Gold
    'CHI': { primary: '#CE1141', secondary: '#000000', accent: '#FFFFFF' }, // Bulls Red/Black
    'MIA': { primary: '#98002E', secondary: '#F9A01B', accent: '#000000' }, // Heat Red/Orange

    // NHL Team Colors (add common ones)
    'LAK': { primary: '#111111', secondary: '#A2AAAD', accent: '#FFFFFF' }, // Kings Black/Silver
    'ANA': { primary: '#F47A38', secondary: '#B9975B', accent: '#000000' }, // Ducks Orange/Gold
    'VGK': { primary: '#B4975A', secondary: '#000000', accent: '#C8AA6E' }, // Golden Knights Gold/Black

    // NFL Team Colors (add common ones)
    'KC': { primary: '#E31837', secondary: '#FFB81C', accent: '#FFFFFF' },  // Chiefs Red/Gold
    'BUF': { primary: '#00338D', secondary: '#C60C30', accent: '#FFFFFF' }, // Bills Blue/Red
    'DAL': { primary: '#041E42', secondary: '#869397', accent: '#FFFFFF' }, // Cowboys Navy/Silver
    'NE': { primary: '#002244', secondary: '#C60C30', accent: '#B0B7BC' }, // Patriots Navy/Red/Silver
  };

  // Generate sport-specific logo function (main implementation)
  const generateSportLogo = (sport: string, teamAbbr: string, teamName: string) => {
    const colors = teamColors[teamAbbr] || { 
      primary: '#1e40af', 
      secondary: '#ffffff', 
      accent: '#000000' 
    };
    
    const abbr = teamAbbr || (teamName || '').slice(0, 3).toUpperCase();

    switch (sport?.toUpperCase()) {
      case 'WNBA':
        // Generate jersey shirt with team colors
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-lg`}>
            {/* Jersey background */}
            <rect x="15" y="20" width="70" height="70" rx="8" fill={colors.primary} stroke={colors.secondary} strokeWidth="2"/>
            
            {/* Jersey sleeves */}
            <ellipse cx="12" cy="35" rx="8" ry="15" fill={colors.primary} stroke={colors.secondary} strokeWidth="1"/>
            <ellipse cx="88" cy="35" rx="8" ry="15" fill={colors.primary} stroke={colors.secondary} strokeWidth="1"/>
            
            {/* Jersey collar */}
            <path d="M 35 20 Q 50 15 65 20 L 65 30 Q 50 25 35 30 Z" fill={colors.secondary} stroke={colors.accent || colors.primary} strokeWidth="1"/>
            
            {/* Team abbreviation */}
            <text x="50" y="55" textAnchor="middle" className="fill-current font-black text-sm" style={{ fill: colors.secondary }}>
              {abbr}
            </text>
            
            {/* Jersey number accent */}
            <circle cx="50" cy="70" r="8" fill={colors.secondary} stroke={colors.accent || colors.primary} strokeWidth="1"/>
            <text x="50" y="75" textAnchor="middle" className="fill-current font-bold text-xs" style={{ fill: colors.primary }}>
              {Math.abs(abbr.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 99 + 1}
            </text>
          </svg>
        );

      case 'NCAAF':
        // Generate football helmet with team colors
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-lg`}>
            {/* Helmet shell */}
            <path d="M 25 35 Q 25 20 50 20 Q 75 20 75 35 L 75 60 Q 75 75 50 75 Q 25 75 25 60 Z" 
                  fill={colors.primary} stroke={colors.secondary} strokeWidth="3"/>
            
            {/* Face mask */}
            <path d="M 30 45 Q 50 40 70 45" stroke={colors.secondary} strokeWidth="2" fill="none"/>
            <path d="M 32 52 Q 50 47 68 52" stroke={colors.secondary} strokeWidth="2" fill="none"/>
            <path d="M 35 59 Q 50 54 65 59" stroke={colors.secondary} strokeWidth="2" fill="none"/>
            
            {/* Helmet stripe */}
            <rect x="47" y="20" width="6" height="55" fill={colors.secondary} rx="3"/>
            
            {/* Team logo area */}
            <circle cx="50" cy="40" r="12" fill={colors.secondary} stroke={colors.accent || colors.primary} strokeWidth="1"/>
            <text x="50" y="46" textAnchor="middle" className="fill-current font-black text-xs" style={{ fill: colors.primary }}>
              {abbr}
            </text>
            
            {/* Helmet chin strap */}
            <ellipse cx="50" cy="70" rx="15" ry="4" fill={colors.secondary} stroke={colors.accent || colors.primary} strokeWidth="1"/>
          </svg>
        );

      case 'NBA':
        // Generate basketball with team colors
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
            <circle cx="50" cy="50" r="45" fill={colors.primary} stroke={colors.secondary} strokeWidth="3"/>
            
            {/* Basketball lines */}
            <path d="M 50 5 Q 50 50 50 95" stroke={colors.secondary} strokeWidth="2" fill="none"/>
            <path d="M 5 50 Q 50 50 95 50" stroke={colors.secondary} strokeWidth="2" fill="none"/>
            <path d="M 15 15 Q 50 50 85 85" stroke={colors.secondary} strokeWidth="1.5" fill="none"/>
            <path d="M 15 85 Q 50 50 85 15" stroke={colors.secondary} strokeWidth="1.5" fill="none"/>
            
            <text x="50" y="58" textAnchor="middle" className="fill-current font-black text-lg" style={{ fill: colors.secondary }}>
              {abbr}
            </text>
          </svg>
        );

      case 'NHL':
        // Generate hockey puck with team colors
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-lg`}>
            <ellipse cx="50" cy="50" rx="45" ry="35" fill={colors.primary} stroke={colors.secondary} strokeWidth="3"/>
            
            {/* Puck edge highlight */}
            <ellipse cx="50" cy="45" rx="40" ry="30" fill="none" stroke={colors.secondary} strokeWidth="1" opacity="0.6"/>
            
            {/* Team text */}
            <text x="50" y="58" textAnchor="middle" className="fill-current font-black text-lg" style={{ fill: colors.secondary }}>
              {abbr}
            </text>
          </svg>
        );

      case 'NFL':
        // Generate football with team colors
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-lg`}>
            <ellipse cx="50" cy="50" rx="35" ry="45" fill={colors.primary} stroke={colors.secondary} strokeWidth="3"/>
            
            {/* Football laces */}
            <line x1="50" y1="20" x2="50" y2="80" stroke={colors.secondary} strokeWidth="2"/>
            <line x1="45" y1="30" x2="55" y2="30" stroke={colors.secondary} strokeWidth="1.5"/>
            <line x1="45" y1="40" x2="55" y2="40" stroke={colors.secondary} strokeWidth="1.5"/>
            <line x1="45" y1="50" x2="55" y2="50" stroke={colors.secondary} strokeWidth="1.5"/>
            <line x1="45" y1="60" x2="55" y2="60" stroke={colors.secondary} strokeWidth="1.5"/>
            <line x1="45" y1="70" x2="55" y2="70" stroke={colors.secondary} strokeWidth="1.5"/>
            
            <text x="50" y="58" textAnchor="middle" className="fill-current font-black text-sm" style={{ fill: colors.secondary }}>
              {abbr}
            </text>
          </svg>
        );

      case 'CFL':
        // Generate Canadian football with team colors (slightly wider)
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-lg`}>
            <ellipse cx="50" cy="50" rx="38" ry="45" fill={colors.primary} stroke={colors.secondary} strokeWidth="3"/>
            
            {/* CFL laces */}
            <line x1="50" y1="20" x2="50" y2="80" stroke={colors.secondary} strokeWidth="2"/>
            <line x1="44" y1="30" x2="56" y2="30" stroke={colors.secondary} strokeWidth="1.5"/>
            <line x1="44" y1="50" x2="56" y2="50" stroke={colors.secondary} strokeWidth="1.5"/>
            <line x1="44" y1="70" x2="56" y2="70" stroke={colors.secondary} strokeWidth="1.5"/>
            
            {/* Maple leaf accent */}
            <path d="M 45 40 L 50 35 L 55 40 L 52 45 L 48 45 Z" fill={colors.accent || colors.secondary} stroke="none"/>
            
            <text x="50" y="68" textAnchor="middle" className="fill-current font-black text-sm" style={{ fill: colors.secondary }}>
              {abbr}
            </text>
          </svg>
        );

      default:
        // Generic sport icon with team colors
        return (
          <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
            <circle cx="50" cy="50" r="45" fill={colors.primary} stroke={colors.secondary} strokeWidth="3"/>
            <circle cx="50" cy="50" r="30" fill="none" stroke={colors.secondary} strokeWidth="1" opacity="0.5"/>
            <text x="50" y="58" textAnchor="middle" className="fill-current font-black text-lg" style={{ fill: colors.secondary }}>
              {abbr}
            </text>
          </svg>
        );
    }
  };

  // For WNBA teams, always use sport-specific generated icons
  if (sport === 'WNBA' && teamAbbr && teamColors[teamAbbr]) {
    console.log(`Using sport-specific icon for WNBA team: ${teamName} (${teamAbbr})`);
    return generateSportLogo('WNBA', teamAbbr, teamName);
  }



  // Generic fallback logo with better styling
  const defaultLogo = generateSportLogo(sport || 'DEFAULT', teamAbbr || '', teamName || '');

  const selectedLogo = teamAbbr ? logoMap[teamAbbr] : null;

  if (!selectedLogo) {
    // Only log warnings for actual team names, not fallback cases
    if (teamName !== 'TBD' && abbreviation !== 'TBD') {
      console.warn(`No logo found for team: ${teamName} (${teamAbbr}), using sport-specific fallback for ${sport}`);
    }
    return defaultLogo;
  }

  return selectedLogo;
}