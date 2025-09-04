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

  // WNBA Teams
  'Phoenix Mercury': 'PHO',
  'Washington Mystics': 'WAS',
  'Golden State Valkyries': 'GSV',
  'Las Vegas Aces': 'LV',
  'Chicago Sky': 'CHI',
  'Connecticut Sun': 'CON',
  'Indiana Fever': 'IND',
  'New York Liberty': 'NYL',
  'Minnesota Lynx': 'MIN',
  'Seattle Storm': 'SEA',
  'Dallas Wings': 'DAL',
  'Atlanta Dream': 'ATL',
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
      'CHI': 'https://content.sportslogos.net/logos/34/874/full/chicago_sky_logo_primary_20142024.png',
      'CON': 'https://content.sportslogos.net/logos/34/878/full/connecticut_sun_logo_primary_20142024.png',
      'IND': 'https://content.sportslogos.net/logos/34/877/full/indiana_fever_logo_primary_20142024.png',
      'NYL': 'https://content.sportslogos.net/logos/34/882/full/new_york_liberty_logo_primary_20142024.png',
      'MIN': 'https://content.sportslogos.net/logos/34/881/full/minnesota_lynx_logo_primary_20142024.png',
      'SEA': 'https://content.sportslogos.net/logos/34/884/full/seattle_storm_logo_primary_20142024.png',
      'DAL': 'https://content.sportslogos.net/logos/34/879/full/dallas_wings_logo_primary_20142024.png',
      'ATL': 'https://content.sportslogos.net/logos/34/876/full/atlanta_dream_logo_primary_20142024.png'
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
    'LV': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">LV</text>
      </svg>
    ),
    'CHI': (
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
    'IND': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">IND</text>
      </svg>
    ),
    'NYL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#4A2584" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">NYL</text>
      </svg>
    ),
    'MIN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">MIN</text>
      </svg>
    ),
    'SEA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">SEA</text>
      </svg>
    ),
    'DAL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">DAL</text>
      </svg>
    ),
    'ATL': (
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
    'MIN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002B5C" stroke="#D31145" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">MIN</text>
      </svg>
    ),
    'TB': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#092C5C" stroke="#8FBCE6" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">TB</text>
      </svg>
    )
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

  // Try to get the official team logo URL first, prioritizing MLB for sports betting app
  const logoUrl = teamAbbr ? getTeamLogoUrl(teamAbbr, 'MLB') : null;

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

  // Generic fallback logo with better styling
  const defaultLogo = (
    <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-white shadow-sm flex items-center justify-center`}>
      <span className="text-white font-black text-xs">{teamAbbr || (teamName || '').slice(0, 3).toUpperCase()}</span>
    </div>
  );

  const selectedLogo = teamAbbr ? logoMap[teamAbbr] : null;

  if (!selectedLogo) {
    // Only log warnings for actual team names, not fallback cases
    if (teamName !== 'TBD' && abbreviation !== 'TBD') {
      console.warn(`No logo found for team: ${teamName} (${teamAbbr}), using fallback`);
    }
    return defaultLogo;
  }

  return selectedLogo;
}