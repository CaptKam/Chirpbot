import React from 'react';

interface TeamLogoProps {
  teamName: string;
  abbreviation?: string;
  sport?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  teamColor?: string;
}

// Team colors mapping organized by sport to avoid conflicts
const teamColorsBySport: Record<string, Record<string, string>> = {
  MLB: {
    'LAD': '#005A9C', 'SF': '#FD5A1E', 'NYY': '#132448', 'BOS': '#BD3039',
    'CHC': '#0E3386', 'MIL': '#FFC52D', 'DET': '#0C2340', 'HOU': '#002D62',
    'PIT': '#FDB827', 'TOR': '#134A8E', 'MIA': '#00A3E0', 'STL': '#C41E3A',
    'PHI': '#E81828', 'SEA': '#0C2C56', 'BAL': '#DF4601', 'ATL': '#CE1141',
    'CWS': '#27251F', 'KC': '#004687', 'TEX': '#C0111F', 'COL': '#33006F',
    'LAA': '#BA0021', 'CIN': '#C6011F', 'ARI': '#A71930', 'CLE': '#E31937',
    'SD': '#2F241D', 'NYM': '#002D72', 'WSH': '#AB0003', 'OAK': '#003831',
    'MIN': '#002B5C', 'TB': '#092C5C'
  },
  NFL: {
    'KC': '#E31837', 'BUF': '#00338D', 'NYJ': '#125740', 'NE': '#002244',
    'MIA': '#008E97', 'PIT': '#FFB612', 'BAL': '#241773', 'CIN': '#FB4F14',
    'CLE': '#311D00', 'HOU': '#03202F', 'IND': '#002C5F', 'JAX': '#006778',
    'TEN': '#0C2340', 'DEN': '#FB4F14', 'LV': '#000000', 'LAC': '#0080C6',
    'DAL': '#003594', 'PHI': '#004C54', 'ATL': '#A71930', 'CHI': '#0B162A',
    'MIN': '#4F2683'
  },
  NBA: {
    'LAL': '#552583', 'LAC': '#C8102E', 'GSW': '#1D428A', 'SAC': '#5A2D81', 
    'PHX': '#1D1160', 'POR': '#E03A3E', 'DEN': '#0E2240', 'UTA': '#002B5C', 
    'OKC': '#007AC1', 'MIN': '#0C2340', 'SAS': '#C4CED4', 'DAL': '#00538C', 
    'MEM': '#5D76A9', 'NO': '#0C2340', 'HOU': '#CE1141', 'MIL': '#00471B', 
    'CHI': '#CE1141', 'IND': '#002D62', 'CLE': '#860038', 'DET': '#C8102E', 
    'ATL': '#E03A3E', 'CHA': '#1D1160', 'MIA': '#98002E', 'ORL': '#0077C0', 
    'WAS': '#002B5C', 'NYK': '#006BB6', 'BKN': '#000000', 'PHI': '#006BB6', 
    'TOR': '#CE1141', 'BOS': '#007A33'
  },
  NHL: {
    'ANA': '#F47A38', 'BOS': '#FFB81C', 'BUF': '#002654', 'CGY': '#C8102E',
    'CAR': '#CC0000', 'CHI': '#CF0A2C', 'COL': '#6F263D', 'CBJ': '#002654',
    'DAL': '#006847', 'DET': '#CE1126', 'EDM': '#041E42', 'FLA': '#041E42',
    'LAK': '#111111', 'MIN': '#154734', 'MTL': '#AF1E2D', 'NSH': '#FFB81C',
    'NJ': '#CE1126', 'NYI': '#00539B', 'NYR': '#0038A8', 'OTT': '#C52032',
    'PHI': '#F74902', 'PIT': '#000000', 'SJ': '#006D75', 'SEA': '#99D9D9',
    'STL': '#002F87', 'TB': '#002868', 'TOR': '#003E7E', 'VAN': '#001F5B',
    'VGK': '#B4975A', 'WAS': '#C8102E', 'WPG': '#041E42'
  },
  WNBA: {
    'ATL': '#E03A3E', 'CHI': '#418FDE', 'CON': '#FF8200', 'DAL': '#C4D600',
    'IND': '#FFD100', 'LAS': '#A6192E', 'MIN': '#23458A', 'NY': '#86CEBC',
    'PHX': '#CB6015', 'SEA': '#2C5234', 'WAS': '#E03A3E', 'GS': '#FDB927'
  },
  CFL: {
    'BC': '#FF6600', 'CGY': '#CE1126', 'EDM': '#004225', 'SSK': '#006A37',
    'WPG': '#041E42', 'HAM': '#FFD100', 'TOR': '#004C9B', 'OTT': '#000000',
    'MTL': '#C8102E'
  },
  NCAAF: {
    'ALA': '#9E1B32', 'GA': '#BA0C2F', 'OSU': '#BB0000', 'CLEM': '#F66733',
    'ND': '#0C2340', 'TEX': '#BF5700', 'USC': '#990000', 'MICH': '#00274C',
    'PSU': '#041E42', 'LSU': '#461D7C', 'FLA': '#0021A5', 'OKLA': '#841617',
    'WIS': '#C5050C', 'ORE': '#154733', 'WASH': '#4B2E83', 'STAN': '#8C1515'
  }
};

// Fallback team colors mapping for backwards compatibility
const teamColors: Record<string, string> = {
  // Flatten all sport colors, with later sports taking precedence for duplicates
  ...teamColorsBySport.MLB,
  ...teamColorsBySport.NFL,
  ...teamColorsBySport.NBA,
  ...teamColorsBySport.NHL,
  ...teamColorsBySport.WNBA,
  ...teamColorsBySport.CFL,
  ...teamColorsBySport.NCAAF
};

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
  'Los Angeles Clippers': 'LAC',
  'Sacramento Kings': 'SAC',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Denver Nuggets': 'DEN',
  'Utah Jazz': 'UTA',
  'Oklahoma City Thunder': 'OKC',
  'Minnesota Timberwolves': 'MIN',
  'San Antonio Spurs': 'SAS',
  'Dallas Mavericks': 'DAL',
  'Memphis Grizzlies': 'MEM',
  'New Orleans Pelicans': 'NO',
  'Houston Rockets': 'HOU',
  'Milwaukee Bucks': 'MIL',
  'Indiana Pacers': 'IND',
  'Cleveland Cavaliers': 'CLE',
  'Detroit Pistons': 'DET',
  'Atlanta Hawks': 'ATL',
  'Charlotte Hornets': 'CHA',
  'Orlando Magic': 'ORL',
  'Washington Wizards': 'WAS',
  'Toronto Raptors': 'TOR',

  // NHL Teams
  'Los Angeles Kings': 'LAK',
  'Anaheim Ducks': 'ANA',
  'Vegas Golden Knights': 'VGK',
  'Colorado Avalanche': 'COL',
  'Dallas Stars': 'DAL',
  'Nashville Predators': 'NSH',
  'Boston Bruins': 'BOS',
  'Buffalo Sabres': 'BUF',
  'Calgary Flames': 'CGY',
  'Carolina Hurricanes': 'CAR',
  'Chicago Blackhawks': 'CHI',
  'Columbus Blue Jackets': 'CBJ',
  'Detroit Red Wings': 'DET',
  'Edmonton Oilers': 'EDM',
  'Florida Panthers': 'FLA',
  'Minnesota Wild': 'MIN',
  'Montreal Canadiens': 'MTL',
  'New Jersey Devils': 'NJ',
  'New York Islanders': 'NYI',
  'New York Rangers': 'NYR',
  'Ottawa Senators': 'OTT',
  'Philadelphia Flyers': 'PHI',
  'Pittsburgh Penguins': 'PIT',
  'San Jose Sharks': 'SJ',
  'Seattle Kraken': 'SEA',
  'St. Louis Blues': 'STL',
  'Tampa Bay Lightning': 'TB',
  'Toronto Maple Leafs': 'TOR',
  'Vancouver Canucks': 'VAN',
  'Washington Capitals': 'WAS',
  'Winnipeg Jets': 'WPG',

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

  // WNBA API format variations (Team Name + Abbreviation) - Match exact API responses
  'Mercury (PHO)': 'PHX',
  'Phoenix Mercury (PHO)': 'PHX',
  'Mystics (MYS)': 'WAS', 
  'Washington Mystics (MYS)': 'WAS',
  'Valkyries (GOL)': 'GS',
  'Golden State Valkyries (GOL)': 'GS',
  'Aces (LAS)': 'LAS',
  'Las Vegas Aces (LAS)': 'LAS',
  'Wings (DAL)': 'DAL',
  'Dallas Wings (DAL)': 'DAL',
  'Sky (CHI)': 'CHI',
  'Chicago Sky (CHI)': 'CHI',
  'Dream (ATL)': 'ATL',
  'Atlanta Dream (ATL)': 'ATL',
  'Fever (IND)': 'IND',
  'Indiana Fever (IND)': 'IND',
  'Liberty (NY)': 'NY',
  'New York Liberty (NY)': 'NY',
  'Storm (SEA)': 'SEA',
  'Seattle Storm (SEA)': 'SEA',
  'Sun (CON)': 'CON',
  'Connecticut Sun (CON)': 'CON',
  'Lynx (MIN)': 'MIN',
  'Minnesota Lynx (MIN)': 'MIN',

  // CFL Teams
  'BC Lions': 'BC',
  'Calgary Stampeders': 'CGY',
  'Edmonton Elks': 'EDM',
  'Saskatchewan Roughriders': 'SSK',
  'Winnipeg Blue Bombers': 'WPG',
  'Hamilton Tiger-Cats': 'HAM',
  'Toronto Argonauts': 'TOR',
  'Ottawa Redblacks': 'OTT',
  'Montreal Alouettes': 'MTL',

  // College Football Teams
  'Alabama Crimson Tide': 'ALA',
  'Georgia Bulldogs': 'GA',
  'Ohio State Buckeyes': 'OSU',
  'Clemson Tigers': 'CLEM',
  'Notre Dame Fighting Irish': 'ND',
  'Texas Longhorns': 'TEX',
  'USC Trojans': 'USC',
  'Michigan Wolverines': 'MICH',
  'Penn State Nittany Lions': 'PSU',
  'LSU Tigers': 'LSU',
  'Florida Gators': 'FLA',
  'Oklahoma Sooners': 'OKLA',
  'Wisconsin Badgers': 'WIS',
  'Oregon Ducks': 'ORE',
  'Washington Huskies': 'WASH',
  'Stanford Cardinal': 'STAN'
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
      'LAR': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'SF': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'SEA': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'AZ': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'ARI': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'NYG': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'WAS': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
      'CAR': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'NO': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'TB': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'DET': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'GB': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
    },
    NCAAF: {
      'ALA': 'https://a.espncdn.com/i/teamlogos/ncf/500/333.png',
      'GA': 'https://a.espncdn.com/i/teamlogos/ncf/500/61.png',
      'OSU': 'https://a.espncdn.com/i/teamlogos/ncf/500/194.png',
      'CLEM': 'https://a.espncdn.com/i/teamlogos/ncf/500/228.png',
      'ND': 'https://a.espncdn.com/i/teamlogos/ncf/500/87.png',
      'TEX': 'https://a.espncdn.com/i/teamlogos/ncf/500/251.png',
      'USC': 'https://a.espncdn.com/i/teamlogos/ncf/500/30.png',
      'MICH': 'https://a.espncdn.com/i/teamlogos/ncf/500/130.png',
      'PSU': 'https://a.espncdn.com/i/teamlogos/ncf/500/213.png',
      'LSU': 'https://a.espncdn.com/i/teamlogos/ncf/500/99.png',
      'FLA': 'https://a.espncdn.com/i/teamlogos/ncf/500/57.png',
      'OKLA': 'https://a.espncdn.com/i/teamlogos/ncf/500/201.png',
      'WIS': 'https://a.espncdn.com/i/teamlogos/ncf/500/275.png',
      'ORE': 'https://a.espncdn.com/i/teamlogos/ncf/500/2483.png',
      'WASH': 'https://a.espncdn.com/i/teamlogos/ncf/500/264.png',
      'STAN': 'https://a.espncdn.com/i/teamlogos/ncf/500/24.png',
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
      'WAS': 'https://a.espncdn.com/i/teamlogos/wnba/500/wsh.png',
      'GS': 'https://a.espncdn.com/i/teamlogos/wnba/500/gsw.png',
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



export function TeamLogo({ teamName, abbreviation, sport, size = 'md', className = '', teamColor }: TeamLogoProps) {
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



  // Final fallback with team colors - use provided color or lookup by sport first, then general lookup
  const finalTeamColor = teamColor || 
    (teamAbbr && sport && teamColorsBySport[sport] ? teamColorsBySport[sport][teamAbbr] : null) ||
    (teamAbbr ? teamColors[teamAbbr] : null);

  const fallbackStyle = finalTeamColor 
    ? { 
        background: `linear-gradient(135deg, ${finalTeamColor}, ${finalTeamColor}dd)`,
        borderColor: 'white'
      }
    : {};

  return (
    <div 
      className={`${sizeClasses[size]} ${className} rounded-full ${finalTeamColor ? '' : 'bg-gradient-to-br from-gray-500 to-gray-600'} border-2 border-white shadow-sm flex items-center justify-center`}
      style={fallbackStyle}
    >
      <span className="text-white font-black text-xs">{teamAbbr || (teamName || '').slice(0, 3).toUpperCase()}</span>
    </div>
  );
}