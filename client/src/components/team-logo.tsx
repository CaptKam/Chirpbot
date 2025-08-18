import React from 'react';

interface TeamLogoProps {
  teamName: string;
  abbreviation?: string;
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
  'Arizona Diamondbacks': 'AZ',
  'Cleveland Guardians': 'CLE',
  'San Diego Padres': 'SD',
  
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
  'Nashville Predators': 'NSH'
};

export function TeamLogo({ teamName, abbreviation, size = 'md', className = '' }: TeamLogoProps) {
  // Early return if teamName is not provided
  if (!teamName) {
    return (
      <div className={`w-8 h-8 ${className} rounded-full bg-gray-400 border-2 border-white shadow-sm flex items-center justify-center`}>
        <span className="text-white font-black text-xs">?</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

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
    'MIA': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#00A3E0" stroke="#EF3340" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">MIA</text>
      </svg>
    ),
    'STL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#C41E3A" stroke="#FEDB00" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">STL</text>
      </svg>
    ),
    'PHI': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#E81828" stroke="#002D72" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">PHI</text>
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
    )
  };

  // Get abbreviation from prop or lookup from team name
  const teamAbbr = abbreviation || teamNameToAbbr[teamName];
  
  // Generic fallback logo with better styling
  const defaultLogo = (
    <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-white shadow-sm flex items-center justify-center`}>
      <span className="text-white font-black text-xs">{teamAbbr || (teamName ? teamName.slice(0, 3).toUpperCase() : '???')}</span>
    </div>
  );

  const selectedLogo = logoMap[teamAbbr];
  
  if (!selectedLogo) {
    console.log(`No logo found for team: ${teamName} (${teamAbbr}), using fallback`);
    return defaultLogo;
  }
  
  return selectedLogo;
}