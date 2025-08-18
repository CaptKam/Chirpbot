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
  'Chicago White Sox': 'CHW',
  'Kansas City Royals': 'KC',
  'Texas Rangers': 'TEX',
  'Colorado Rockies': 'COL',
  'Los Angeles Angels': 'LAA',
  'Cincinnati Reds': 'CIN',
  'Arizona Diamondbacks': 'ARI',
  'Cleveland Guardians': 'CLE',
  'San Diego Padres': 'SD',
  'Tampa Bay Rays': 'TB',
  'New York Mets': 'NYM',
  'Washington Nationals': 'WSH',
  'Minnesota Twins': 'MIN',
  'Oakland Athletics': 'OAK',
  
  // Common shortened MLB team names from ESPN/API
  'Yankees': 'NYY',
  'Red Sox': 'BOS',
  'Dodgers': 'LAD',
  'Giants': 'SF',
  'Angels': 'LAA',
  'Padres': 'SD',
  'Athletics': 'OAK',
  'A\'s': 'OAK',
  'Mariners': 'SEA',
  'Rangers': 'TEX',
  'Astros': 'HOU',
  'Guardians': 'CLE',
  'Tigers': 'DET',
  'Twins': 'MIN',
  'Royals': 'KC',
  'White Sox': 'CHW',
  'Rays': 'TB',
  'Orioles': 'BAL',
  'Blue Jays': 'TOR',
  'Braves': 'ATL',
  'Marlins': 'MIA',
  'Mets': 'NYM',
  'Phillies': 'PHI',
  'Nationals': 'WSH',
  'Cubs': 'CHC',
  'Reds': 'CIN',
  'Brewers': 'MIL',
  'Pirates': 'PIT',
  'Cardinals': 'STL',
  'Diamondbacks': 'ARI',
  'D-backs': 'ARI',
  'Rockies': 'COL',
  
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
  'Los Angeles Rams': 'LAR',
  'Seattle Seahawks': 'SEA',
  'San Francisco 49ers': 'SF',
  'Arizona Cardinals': 'ARI',
  'Dallas Cowboys': 'DAL',
  'New York Giants': 'NYG',
  'Philadelphia Eagles': 'PHI',
  'Washington Commanders': 'WSH',
  'Green Bay Packers': 'GB',
  'Chicago Bears': 'CHI',
  'Minnesota Vikings': 'MIN',
  'Detroit Lions': 'DET',
  'Tampa Bay Buccaneers': 'TB',
  'New Orleans Saints': 'NO',
  'Atlanta Falcons': 'ATL',
  'Carolina Panthers': 'CAR',
  
  // NBA Teams  
  'Los Angeles Lakers': 'LAL',
  'Boston Celtics': 'CEL',
  'Golden State Warriors': 'GSW',
  'Chicago Bulls': 'CHI',
  'Miami Heat': 'MIA',
  'New York Knicks': 'NYK',
  'Brooklyn Nets': 'BKN',
  'Philadelphia 76ers': 'PHI',
  'Milwaukee Bucks': 'MIL',
  'Toronto Raptors': 'TOR',
  'Denver Nuggets': 'DEN',
  'Phoenix Suns': 'PHX',
  'Los Angeles Clippers': 'LAC',
  'Sacramento Kings': 'SAC',
  'Dallas Mavericks': 'DAL',
  'San Antonio Spurs': 'SAS',
  'Houston Rockets': 'HOU',
  'Memphis Grizzlies': 'MEM',
  'New Orleans Pelicans': 'NOP',
  'Oklahoma City Thunder': 'OKC',
  'Minnesota Timberwolves': 'MIN',
  'Utah Jazz': 'UTA',
  'Portland Trail Blazers': 'POR',
  'Indiana Pacers': 'IND',
  'Cleveland Cavaliers': 'CLE',
  'Detroit Pistons': 'DET',
  'Atlanta Hawks': 'ATL',
  'Charlotte Hornets': 'CHA',
  'Orlando Magic': 'ORL',
  'Washington Wizards': 'WAS',
  
  // NHL Teams
  'Los Angeles Kings': 'LAK',
  'Anaheim Ducks': 'ANA',
  'Vegas Golden Knights': 'VGK',
  'Colorado Avalanche': 'COL',
  'Dallas Stars': 'DAL',
  'Nashville Predators': 'NSH',
  'Arizona Coyotes': 'ARI',
  'Calgary Flames': 'CGY',
  'Edmonton Oilers': 'EDM',
  'Seattle Kraken': 'SEA',
  'San Jose Sharks': 'SJS',
  'Vancouver Canucks': 'VAN',
  'Chicago Blackhawks': 'CHI',
  'St. Louis Blues': 'STL',
  'Minnesota Wild': 'MIN',
  'Winnipeg Jets': 'WPG',
  'Boston Bruins': 'BOS',
  'Buffalo Sabres': 'BUF',
  'Detroit Red Wings': 'DET',
  'Florida Panthers': 'FLA',
  'Montreal Canadiens': 'MTL',
  'Ottawa Senators': 'OTT',
  'Tampa Bay Lightning': 'TBL',
  'Toronto Maple Leafs': 'TOR',
  'Carolina Hurricanes': 'CAR',
  'Columbus Blue Jackets': 'CBJ',
  'New Jersey Devils': 'NJD',
  'New York Islanders': 'NYI',
  'New York Rangers': 'NYR',
  'Philadelphia Flyers': 'PHI',
  'Pittsburgh Penguins': 'PIT',
  'Washington Capitals': 'WSH'
};

// Version 5.0 - Force complete refresh with new component name
export function TeamLogoV5({ teamName, abbreviation, size = 'md', className = '' }: TeamLogoProps) {
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

  // Get abbreviation from team name
  const teamAbbr = abbreviation || teamNameToAbbr[teamName];

  const logoMap: Record<string, JSX.Element> = {
    // MLB Teams - Professional Style Logos
    'LAD': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className}`}>
        {/* Dodgers Baseball Diamond Shape */}
        <path d="M50 10 L85 50 L50 90 L15 50 Z" fill="#005A9C" stroke="#FFFFFF" strokeWidth="2"/>
        <path d="M50 25 L70 50 L50 75 L30 50 Z" fill="#FFFFFF"/>
        <text x="50" y="45" textAnchor="middle" className="fill-blue-600 font-black text-lg font-serif">LA</text>
        <text x="50" y="62" textAnchor="middle" className="fill-blue-600 font-bold text-xs font-serif">DODGERS</text>
      </svg>
    ),
    'SF': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className}`}>
        {/* Giants Baseball with Bridge Arc */}
        <circle cx="50" cy="50" r="45" fill="#FD5A1E" stroke="#27251F" strokeWidth="3"/>
        <path d="M15 45 Q50 15 85 45" fill="none" stroke="#27251F" strokeWidth="4"/>
        <path d="M15 45 Q50 20 85 45" fill="none" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="60" textAnchor="middle" className="fill-white font-black text-xl font-sans">SF</text>
        <circle cx="25" cy="45" r="2" fill="#27251F"/>
        <circle cx="75" cy="45" r="2" fill="#27251F"/>
      </svg>
    ),
    'NYY': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className}`}>
        {/* Yankees Top Hat Shape */}
        <ellipse cx="50" cy="75" rx="40" ry="8" fill="#132448"/>
        <rect x="25" y="35" width="50" height="40" fill="#132448" rx="3"/>
        <rect x="30" y="25" width="40" height="15" fill="#132448" rx="8"/>
        <path d="M25 65 L75 65 L75 75 L25 75 Z" fill="#C4CED4"/>
        <text x="50" y="55" textAnchor="middle" className="fill-white font-black text-xl font-serif">NY</text>
      </svg>
    ),
    'BOS': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className}`}>
        {/* Red Sox Sock Shape */}
        <path d="M30 20 L70 20 L75 30 L75 70 L70 80 L60 85 L40 85 L30 80 L25 70 L25 30 Z" fill="#BD3039" stroke="#0C2340" strokeWidth="2"/>
        <path d="M30 25 L70 25 L70 35 L30 35 Z" fill="#FFFFFF"/>
        <path d="M30 45 L70 45 L70 55 L30 55 Z" fill="#FFFFFF"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-sm font-sans">SOX</text>
      </svg>
    ),
    'CHC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className}`}>
        {/* Cubs Bear Head Silhouette */}
        <path d="M50 20 Q65 25 70 40 Q75 45 70 55 Q75 60 70 70 Q65 75 50 80 Q35 75 30 70 Q25 60 30 55 Q25 45 30 40 Q35 25 50 20 Z" fill="#0E3386" stroke="#CC3433" strokeWidth="2"/>
        <circle cx="42" cy="45" r="3" fill="#FFFFFF"/>
        <circle cx="58" cy="45" r="3" fill="#FFFFFF"/>
        <path d="M45 55 Q50 60 55 55" fill="none" stroke="#FFFFFF" strokeWidth="2"/>
        <text x="50" y="90" textAnchor="middle" className="fill-blue-700 font-black text-xs font-sans">CUBS</text>
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
    'CHW': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#27251F" stroke="#C4CED4" strokeWidth="2"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-base font-sans">CHW</text>
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
    'ARI': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#A71930" stroke="#E3D4AD" strokeWidth="3"/>
        <polygon points="35,30 65,30 50,20" fill="#E3D4AD"/>
        <text x="50" y="65" textAnchor="middle" className="fill-white font-black text-sm font-sans">D-BACKS</text>
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
    'WSH': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#5A1414" stroke="#FFB612" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-yellow-400 font-black text-base font-sans">WSH</text>
      </svg>
    ),
    'TEN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0C2340" stroke="#4B92DB" strokeWidth="3"/>
        <polygon points="30,35 70,35 60,50 40,50" fill="#4B92DB"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-sm font-sans">TITANS</text>
      </svg>
    ),
    'GB': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#203731" stroke="#FFB612" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-yellow-400 font-black text-xl font-sans">G</text>
      </svg>
    ),
    'IND': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002C5F" stroke="#A2AAAD" strokeWidth="2"/>
        <polygon points="35,35 65,35 50,20" fill="#A2AAAD"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">COLTS</text>
      </svg>
    ),
    'NE': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#002244" stroke="#C60C30" strokeWidth="3"/>
        <polygon points="30,40 70,40 60,25 40,25" fill="#C60C30"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">PATS</text>
      </svg>
    ),
    'MIN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#4F2683" stroke="#FFC62F" strokeWidth="3"/>
        <polygon points="35,30 65,30 55,45 45,45" fill="#FFC62F"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">VIKINGS</text>
      </svg>
    ),
    'CAR': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0085CA" stroke="#101820" strokeWidth="3"/>
        <circle cx="50" cy="45" r="15" fill="none" stroke="#101820" strokeWidth="2"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">PANTHERS</text>
      </svg>
    ),
    'LV': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#000000" stroke="#A5ACAF" strokeWidth="2"/>
        <polygon points="35,30 65,30 55,50 45,50" fill="#A5ACAF"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">RAIDERS</text>
      </svg>
    ),
    'DAL': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#003594" stroke="#041E42" strokeWidth="3"/>
        <polygon points="50,20 35,45 65,45" fill="#041E42"/>
        <polygon points="50,30 40,45 60,45" fill="#869397"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">COWBOYS</text>
      </svg>
    ),
    'LAC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0080C6" stroke="#FFC20E" strokeWidth="3"/>
        <polygon points="40,30 60,30 65,50 35,50" fill="#FFC20E"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">CHARGERS</text>
      </svg>
    ),
    'LAR': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#003594" stroke="#FFA300" strokeWidth="3"/>
        <circle cx="50" cy="45" r="20" fill="none" stroke="#FFA300" strokeWidth="3"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">RAMS</text>
      </svg>
    ),
    'NYJ': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#125740" stroke="#FFFFFF" strokeWidth="2"/>
        <polygon points="30,35 70,35 65,50 35,50" fill="#FFFFFF"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-sm font-sans">JETS</text>
      </svg>
    ),
    'NYG': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0B2265" stroke="#A71930" strokeWidth="3"/>
        <text x="50" y="50" textAnchor="middle" className="fill-white font-black text-2xl font-sans">ny</text>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">GIANTS</text>
      </svg>
    ),
    'TB': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#D50A0A" stroke="#FF7900" strokeWidth="3"/>
        <polygon points="30,35 70,35 60,50 40,50" fill="#FF7900"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">BUCS</text>
      </svg>
    ),
    'DEN': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#FB4F14" stroke="#002244" strokeWidth="3"/>
        <polygon points="35,30 65,30 55,45 45,45" fill="#002244"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">BRONCOS</text>
      </svg>
    ),
    'JAX': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#101820" stroke="#D7A22A" strokeWidth="3"/>
        <circle cx="50" cy="45" r="15" fill="none" stroke="#D7A22A" strokeWidth="2"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">JAGUARS</text>
      </svg>
    ),
    'NO': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#101820" stroke="#D3BC8D" strokeWidth="3"/>
        <polygon points="30,25 70,25 70,35 30,35" fill="#D3BC8D"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-sm font-sans">SAINTS</text>
      </svg>
    ),
    'CHI': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#0B162A" stroke="#C83803" strokeWidth="3"/>
        <text x="50" y="58" textAnchor="middle" className="fill-white font-black text-xl font-sans">C</text>
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
    'GSW': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#1D428A" stroke="#FFC72C" strokeWidth="3"/>
        <polygon points="30,30 70,30 60,50 40,50" fill="#FFC72C"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">WARRIORS</text>
      </svg>
    ),
    'OKC': (
      <svg viewBox="0 0 100 100" className={`${sizeClasses[size]} ${className} rounded-full`}>
        <circle cx="50" cy="50" r="48" fill="#007AC1" stroke="#EF3B24" strokeWidth="3"/>
        <polygon points="40,30 60,30 65,50 35,50" fill="#EF3B24"/>
        <text x="50" y="70" textAnchor="middle" className="fill-white font-black text-xs font-sans">THUNDER</text>
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
  
  // Generic fallback logo with better styling
  const defaultLogo = (
    <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-white shadow-sm flex items-center justify-center`}>
      <span className="text-white font-black text-xs">{teamAbbr || (teamName ? teamName.slice(0, 3).toUpperCase() : '???')}</span>
    </div>
  );

  const selectedLogo = logoMap[teamAbbr];
  
  if (!selectedLogo) {
    console.log(`❌ No logo found for team: "${teamName}" -> "${teamAbbr}"`);
    return defaultLogo;
  }
  
  // Return logo with unique timestamp to force refresh
  const timestamp = new Date().getTime();
  return (
    <div key={`logo-wrapper-${teamAbbr}-${timestamp}`} className={`${sizeClasses[size]} ${className}`}>
      {selectedLogo}
    </div>
  );
}

// Export with both names for compatibility
export const TeamLogo = TeamLogoV5;