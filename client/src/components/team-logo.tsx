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
  'Atlanta Dream': 'ATL',
  'Chicago Sky': 'CHI',
  'Connecticut Sun': 'CON',
  'Dallas Wings': 'DAL',
  'Indiana Fever': 'IND',
  'Las Vegas Aces': 'LAS',
  'Minnesota Lynx': 'MIN',
  'New York Liberty': 'NY',
  'Phoenix Mercury': 'PHX',
  'Seattle Storm': 'SEA',
  'Washington Mystics': 'WAS',
  'Golden State Valkyries': 'GS',

  // Common shortened names for WNBA
  'Dream': 'ATL',
  'Sky': 'CHI',
  'Sun': 'CON',
  'Wings': 'DAL',
  'Fever': 'IND',
  'Aces': 'LAS',
  'Lynx': 'MIN',
  'Liberty': 'NY',
  'Mercury': 'PHX',
  'Storm': 'SEA',
  'Mystics': 'WAS',
  'Valkyries': 'GS',

  // WNBA API format variations (Team Name + Abbreviation)
  'Mercury (PHO)': 'PHX',
  'Mercury (PHX)': 'PHX',
  'Mystics (MYS)': 'WAS',
  'Mystics (WAS)': 'WAS',
  'Valkyries (GOL)': 'GS',
  'Valkyries (GS)': 'GS',
  'Aces (LAS)': 'LAS',
  'Aces (LV)': 'LAS',
  'Wings (DAL)': 'DAL',
  'Sky (CHI)': 'CHI',
  'Dream (ATL)': 'ATL',
  'Fever (IND)': 'IND',
  'Liberty (NY)': 'NY',
  'Liberty (NYL)': 'NY',
  'Storm (SEA)': 'SEA',
  'Sun (CON)': 'CON',
  'Sun (CONN)': 'CON',
  'Lynx (MIN)': 'MIN'
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
      'ATL': 'https://a.espncdn.com/i/teamlogos/wnba/500/atl.png',
      'CHI': 'https://a.espncdn.com/i/teamlogos/wnba/500/chi.png',
      'CON': 'https://a.espncdn.com/i/teamlogos/wnba/500/conn.png',
      'DAL': 'https://a.espncdn.com/i/teamlogos/wnba/500/dal.png',
      'IND': 'https://a.espncdn.com/i/teamlogos/wnba/500/ind.png',
      'LAS': 'https://a.espncdn.com/i/teamlogos/wnba/500/lv.png',
      'MIN': 'https://a.espncdn.com/i/teamlogos/wnba/500/min.png',
      'NY': 'https://a.espncdn.com/i/teamlogos/wnba/500/ny.png',
      'PHX': 'https://a.espncdn.com/i/teamlogos/wnba/500/phx.png',
      'SEA': 'https://a.espncdn.com/i/teamlogos/wnba/500/sea.png',
      'WAS': 'https://a.espncdn.com/i/teamlogos/wnba/500/was.png',
      'GS': 'https://a.espncdn.com/i/teamlogos/wnba/500/gs.png',
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

// Generic sport-specific icon generators
const getSportIcon = (sport: string, teamAbbr: string, size: string, className: string) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  switch (sport) {
    case 'NCAAF':
      // Football helmet for NCAAF
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
          <ellipse cx="50" cy="55" rx="35" ry="40" fill="#002D62" stroke="#FFFFFF" strokeWidth="2"/>
          <rect x="15" y="45" width="70" height="4" fill="#FFFFFF"/>
          <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-sm font-sans">{teamAbbr}</text>
        </svg>
      );

    case 'NBA':
      // Basketball for NBA
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
          <circle cx="50" cy="50" r="45" fill="#FF6B00" stroke="#000000" strokeWidth="2"/>
          <path d="M 50 5 Q 75 50 50 95" stroke="#000000" strokeWidth="1" fill="none"/>
          <path d="M 5 50 Q 50 25 95 50" stroke="#000000" strokeWidth="1" fill="none"/>
          <text x="50" y="55" textAnchor="middle" className="fill-white font-black text-xs font-sans">{teamAbbr}</text>
        </svg>
      );

    case 'NHL':
      // Hockey puck for NHL
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
          <ellipse cx="50" cy="50" rx="45" ry="20" fill="#000000" stroke="#C0C0C0" strokeWidth="2"/>
          <text x="50" y="55" textAnchor="middle" className="fill-white font-black text-sm font-sans">{teamAbbr}</text>
        </svg>
      );

    default:
      // Generic fallback
      return (
        <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-white shadow-sm flex items-center justify-center`}>
          <span className="text-white font-black text-xs">{teamAbbr}</span>
        </div>
      );
  }
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

  // For sports without ESPN logos, use sport-specific icons
  if (sport && ['NCAAF'].includes(sport)) {
    return getSportIcon(sport, teamAbbr || (teamName || '').slice(0, 3).toUpperCase(), size, className);
  }

  // Try to get the official team logo URL first
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
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // Generic fallback with sport-specific styling if available
  if (sport && ['NBA', 'NHL'].includes(sport)) {
    return getSportIcon(sport, teamAbbr || (teamName || '').slice(0, 3).toUpperCase(), size, className);
  }

  // Final fallback
  return (
    <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-white shadow-sm flex items-center justify-center`}>
      <span className="text-white font-black text-xs">{teamAbbr || (teamName || '').slice(0, 3).toUpperCase()}</span>
    </div>
  );
}