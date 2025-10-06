import React from 'react';

interface TeamLogoProps {
  teamName: string;
  abbreviation?: string;
  sport?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  teamColor?: string;
}

// Helper function to remove city from team names
const removeCity = (teamName: string) => {
  if (!teamName) return '';
  const words = teamName.split(' ');
  return words.length > 1 ? words.slice(-1).join(' ') : teamName;
};

// Helper function to remove mascot from NCAAF team names
const removeNcaafMascot = (teamName: string) => {
  if (!teamName) return '';

  // Common NCAAF mascots to remove
  const mascots = [
    'Tigers', 'Bulldogs', 'Crimson Tide', 'Volunteers', 'Gators', 'Wildcats',
    'Aggies', 'Longhorns', 'Sooners', 'Trojans', 'Bruins', 'Cardinal', 
    'Fighting Irish', 'Seminoles', 'Hurricanes', 'Cavaliers', 'Yellow Jackets',
    'Blue Devils', 'Demon Deacons', 'Tar Heels', 'Wolfpack', 'Orange',
    'Eagles', 'Panthers', 'Cardinals', 'Badgers', 'Hawkeyes', 'Cornhuskers',
    'Wolverines', 'Buckeyes', 'Nittany Lions', 'Spartans', 'Hoosiers',
    'Boilermakers', 'Terrapins', 'Scarlet Knights', 'Golden Gophers',
    'Illini', 'Horned Frogs', 'Red Raiders', 'Mountaineers', 'Cowboys',
    'Jayhawks', 'Cyclones', 'Bears', 'Ducks', 'Beavers', 'Huskies',
    'Cougars', 'Sun Devils', 'Utes', 'Buffaloes', 'Knights', 'Bulls',
    'Bearcats', 'Rebels', 'Rainbow Warriors', 'Aztecs', 'Broncos', 'Mustangs',
    'Mean Green', 'Owls', 'Golden Panthers', 'Blazers', 'Roadrunners'
  ];

  // Remove mascot if found at the end
  for (const mascot of mascots) {
    if (teamName.endsWith(mascot)) {
      return teamName.replace(mascot, '').trim();
    }
  }

  return teamName;
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
  'Lakers': 'LAL',
  'Boston Celtics': 'BOS',
  'Celtics': 'BOS',
  'Golden State Warriors': 'GSW',
  'Warriors': 'GSW',
  'Chicago Bulls': 'CHI',
  'Bulls': 'CHI',
  'Miami Heat': 'MIA',
  'Heat': 'MIA',
  'New York Knicks': 'NYK',
  'Knicks': 'NYK',
  'Brooklyn Nets': 'BKN',
  'Nets': 'BKN',
  'Philadelphia 76ers': 'PHI',
  '76ers': 'PHI',
  'Dallas Mavericks': 'DAL',
  'Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Nuggets': 'DEN',
  'Houston Rockets': 'HOU',
  'Rockets': 'HOU',
  'Memphis Grizzlies': 'MEM',
  'Grizzlies': 'MEM',
  'Milwaukee Bucks': 'MIL',
  'Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'Pelicans': 'NOP',
  'Oklahoma City Thunder': 'OKC',
  'Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Magic': 'ORL',
  'Phoenix Suns': 'PHX',
  'Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Jazz': 'UTA',
  'Washington Wizards': 'WAS',
  'Wizards': 'WAS',
  'Atlanta Hawks': 'ATL',
  'Hawks': 'ATL',
  'Cleveland Cavaliers': 'CLE',
  'Cavaliers': 'CLE',
  'Detroit Pistons': 'DET',
  'Pistons': 'DET',
  'Indiana Pacers': 'IND',
  'Pacers': 'IND',
  'Charlotte Hornets': 'CHA',
  'Hornets': 'CHA',
  'Los Angeles Clippers': 'LAC',
  'Clippers': 'LAC',

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

  // NCAAF Teams (example, add more as needed)
  'Alabama Crimson Tide': 'ALA',
  'LSU Tigers': 'LSU',
  'Ohio State Buckeyes': 'OSU',
  'Michigan Wolverines': 'MICH',
  'Georgia Bulldogs': 'UGA',
  'Texas Longhorns': 'TEX',
  'Oklahoma Sooners': 'OU',
  'USC Trojans': 'USC',
  'Oregon Ducks': 'ORE',
  'Penn State Nittany Lions': 'PSU',
  'Clemson Tigers': 'CLEM',
  'Florida State Seminoles': 'FSU',
  'Miami Hurricanes': 'MIA',
  'North Carolina Tar Heels': 'UNC',
  'Virginia Cavaliers': 'UVA',
  'Georgia Tech Yellow Jackets': 'GT',
  'Duke Blue Devils': 'DUKE',
  'Wake Forest Demon Deacons': 'WAKE',
  'NC State Wolfpack': 'NCSU',
  'Syracuse Orange': 'CUSE',
  'Eastern Washington Eagles': 'EWU',
  'Montana State Bobcats': 'MTST',
  'North Dakota State Bison': 'NDSU',
  'James Madison Dukes': 'JMU',
  'South Dakota State Jackrabbits': 'SDST',
  'Villanova Wildcats': 'NOVA',
  'William & Mary Tribe': 'W&M',
  'Northern Iowa Panthers': 'UNI',
  'Southern Illinois Salukis': 'SIU',
  'Missouri State Bears': 'MOST',
  'Western Illinois Leathernecks': 'WIU',
  'Indiana State Sycamores': 'INS',
  'Youngstown State Penguins': 'YSU',
  'South Dakota Coyotes': 'USD',
  'North Dakota Fighting Hawks': 'UND',
  'Illinois Fighting Illini': 'ILL',
  'Wisconsin Badgers': 'WISC',
  'Iowa Hawkeyes': 'IOWA',
  'Nebraska Cornhuskers': 'NEB',
  'Purdue Boilermakers': 'PUR',
  'Michigan State Spartans': 'MSU',
  'Rutgers Scarlet Knights': 'RUTG',
  'Maryland Terrapins': 'MD',
  'Northwestern Wildcats': 'NW',
  'Kansas Jayhawks': 'KU',
  'Iowa State Cyclones': 'ISU',
  'Oklahoma State Cowboys': 'OKST',
  'Baylor Bears': 'BAYLOR',
  'TCU Horned Frogs': 'TCU',
  'Texas Tech Red Raiders': 'TTU',
  'West Virginia Mountaineers': 'WVU',
  'BYU Cougars': 'BYU',
  'Utah Utes': 'UTAH',
  'Colorado Buffaloes': 'CU',
  'Arizona State Sun Devils': 'ASU',
  'Washington Huskies': 'WASH',
  'Stanford Cardinal': 'STAN',
  'Cal Golden Bears': 'CAL',
  'UCLA Bruins': 'UCLA',
  'Oregon State Beavers': 'ORST',
  'Washington State Cougars': 'WSU',
  'Boise State Broncos': 'BSU',
  'Fresno State Bulldogs': 'FRESNO',
  'San Diego State Aztecs': 'SDSU',
  'Wyoming Cowboys': 'WYO',
  'Colorado State Rams': 'CSU',
  'Nevada Wolf Pack': 'NEV',
  'New Mexico Lobos': 'UNM',
  'Utah State Aggies': 'USU',
  'Air Force Falcons': 'AF',
  'Hawaii Rainbow Warriors': 'HAWAII',
  'San Jose State Spartans': 'SJSU',
  'UNLV Rebels': 'UNLV',
  'New Mexico State Aggies': 'NMSU',
  'Louisiana Tech Bulldogs': 'LT',
  'Southern Miss Golden Eagles': 'USM',
  'Arkansas State Red Wolves': 'ARST',
  'Troy Trojans': 'TROY',
  'South Alabama Jaguars': 'USA',
  'Georgia State Panthers': 'GSU',
  'Appalachian State Mountaineers': 'APP',
  'Coastal Carolina Chanticleers': 'CCU',
  "UL Lafayette Ragin' Cajuns": 'UL',
  'UL Monroe Warhawks': 'ULM',
  'Texas State Bobcats': 'TXST',
  'UT Arlington Mavericks': 'UTA',
  'UT Rio Grande Valley Vaqueros': 'UTRGV',
  'UTSA Roadrunners': 'UTSA',
  'Western Kentucky Hilltoppers': 'WKU',
  'Marshall Thundering Herd': 'MARSHALL',
  'Old Dominion Monarchs': 'ODU',
  'Charlotte 49ers': 'CHARLOTTE',
  'Middle Tennessee Blue Raiders': 'MT',
  'UAB Blazers': 'UAB',
  'UTEP Miners': 'UTEP',
  'Rice Owls': 'RICE',
  'North Texas Mean Green': 'UNT',
  'Florida Gators': 'UF',
  'Kentucky Wildcats': 'UK',
  'Missouri Tigers': 'MIZZOU',
  'South Carolina Gamecocks': 'SC',
  'Vanderbilt Commodores': 'VANDY',
  'Arkansas Razorbacks': 'ARK',
  'Auburn Tigers': 'AUB',
  'Ole Miss Rebels': 'UM',
  'Texas A&M Aggies': 'TAMU',
  'Tennessee Volunteers': 'TENN',
  'UConn Huskies': 'UCONN',
  'Boston College Eagles': 'BC',
  'Louisville Cardinals': 'LOU',
  'Pittsburgh Panthers': 'PITT',
  'Virginia Tech Hokies': 'VT',
};

// Helper function to get team color (fallback for when teamColor prop is not provided)
// This is a simplified version. A more robust solution might involve a map or API call.
const getTeamColor = (teamName: string): string => {
  // Example colors - replace with actual logic or data source
  if (teamName.includes('Lakers')) return '#552583';
  if (teamName.includes('Celtics')) return '#007A33';
  if (teamName.includes('Warriors')) return '#006BB6';
  if (teamName.includes('Bulls')) return '#CE1141';
  if (teamName.includes('Heat')) return '#990012';
  if (teamName.includes('Knicks')) return '#003366';
  if (teamName.includes('Nets')) return '#000000';
  if (teamName.includes('76ers')) return '#006BB6';
  if (teamName.includes('Dodgers')) return '#005A9C';
  if (teamName.includes('Giants')) return '#FD5A1E';
  if (teamName.includes('Yankees')) return '#002775';
  if (teamName.includes('Red Sox')) return '#C60C30';
  if (teamName.includes('Chiefs')) return '#E31837';
  if (teamName.includes('Bills')) return '#00338D';
  if (teamName.includes('Patriots')) return '#002244';
  if (teamName.includes('Steelers')) return '#FFB612';
  return '#808080'; // Default gray
};

// ESPN team logo URLs - these return actual mascot logos
const getTeamLogoUrl = (teamAbbr: string, sport?: string): string | null => {
  // ESPN logo URLs by sport
  const espnLogos: Record<string, Record<string, string>> = {
    NBA: {
      'LAL': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      'BOS': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
      'GSW': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
      'CHI': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
      'MIA': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
      'NYK': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
      'BKN': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
      'PHI': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
      'DAL': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
      'DEN': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
      'HOU': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
      'MEM': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
      'MIL': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
      'MIN': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
      'NO': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
      'NOP': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
      'OKC': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
      'ORL': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
      'PHX': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
      'POR': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
      'SAC': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
      'SA': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
      'SAS': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
      'TOR': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
      'UTA': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
      'WAS': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
      'ATL': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
      'CLE': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
      'DET': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
      'IND': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
      'CHA': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
      'LAC': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    },
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
      'WAS': 'https://a.espncdn.com/i/teamlogos/wnba/500/wsh.png',
      'GS': 'https://a.espncdn.com/i/teamlogos/wnba/500/gsw.png',
    },
    NCAAF: {
      'ALA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/22.png',
      'LSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/115.png',
      'OSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/215.png',
      'MICH': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/123.png',
      'UGA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/70.png',
      'TEX': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/247.png',
      'OU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/211.png',
      'USC': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/25.png',
      'ORE': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/221.png',
      'PSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/227.png',
      'CLEM': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/197.png',
      'FSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/74.png',
      'MIA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/77.png',
      'UNC': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/191.png',
      'UVA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/276.png',
      'GT': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/79.png',
      'DUKE': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/63.png',
      'WAKE': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/282.png',
      'NCSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/196.png',
      'CUSE': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/188.png',
      'EWU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3117.png',
      'MSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/134.png',
      'NDSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/159.png',
      'JMU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/114.png',
      'SDSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/240.png',
      'NOVA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/147.png',
      'W&M': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/128.png',
      'UNI': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/164.png',
      'SIU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/241.png',
      'INS': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/97.png',
      'YSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/309.png',
      'USD': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/160.png',
      'UND': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/158.png',
      'ILL': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/85.png',
      'WISC': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/292.png',
      'IOWA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/94.png',
      'NEB': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/145.png',
      'PUR': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/223.png',
      'RUTG': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/177.png',
      'MD': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/121.png',
      'NW': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/195.png',
      'KU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/104.png',
      'ISU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/95.png',
      'OKST': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/213.png',
      'BAYLOR': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/35.png',
      'TCU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/246.png',
      'TTU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/248.png',
      'WVU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/295.png',
      'BYU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/38.png',
      'UTAH': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/264.png',
      'CU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/48.png',
      'ASU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/24.png',
      'WASH': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/287.png',
      'STAN': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/244.png',
      'CAL': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/27.png',
      'UCLA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/26.png',
      'ORST': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/221.png',
      'WSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/288.png',
      'BSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/36.png',
      'FRESNO': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/67.png',
      'WYO': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/298.png',
      'CSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/49.png',
      'NEV': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/146.png',
      'UNM': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/155.png',
      'USU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/265.png',
      'AF': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/1.png',
      'HAWAII': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/81.png',
      'SJSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/242.png',
      'UNLV': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/156.png',
      'NMSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/154.png',
      'LT': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/111.png',
      'USM': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/243.png',
      'ARST': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/23.png',
      'TROY': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/260.png',
      'USA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3115.png',
      'GSU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3107.png',
      'APP': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/17.png',
      'CCU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3102.png',
      'UL': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/113.png',
      'ULM': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/116.png',
      'TXST': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3121.png',
      'UTA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/253.png',
      'UTRGV': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3114.png',
      'UTSA': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3120.png',
      'WKU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/130.png',
      'MARSHALL': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/124.png',
      'ODU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3112.png',
      'CHARLOTTE': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3099.png',
      'MT': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/137.png',
      'UAB': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/3122.png',
      'UTEP': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/254.png',
      'RICE': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/176.png',
      'UNT': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/152.png',
      'UF': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/75.png',
      'UK': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/103.png',
      'MIZZOU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/132.png',
      'SC': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/237.png',
      'VANDY': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/271.png',
      'ARK': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/22.png',
      'AUB': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/26.png',
      'UM': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/131.png',
      'TAMU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/249.png',
      'TENN': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/244.png',
      'UCONN': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/54.png',
      'BC': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/34.png',
      'LOU': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/112.png',
      'PITT': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/216.png',
      'VT': 'https://a.espncdn.com/i/teamlogos/ncaaf/500/277.png',
    }
  };

  // If sport is specified, ONLY look in that sport (prevent cross-sport contamination)
  if (sport) {
    if (espnLogos[sport] && espnLogos[sport][teamAbbr]) {
      return espnLogos[sport][teamAbbr];
    }
    // Sport specified but logo not found - return null (don't search other sports)
    return null;
  }

  // Fallback: only when NO sport specified, search all sports
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
  
  // Determine the display name, removing mascot for NCAAF if necessary
  let displayName = teamName;
  if (sport === 'NCAAF') {
    displayName = removeNcaafMascot(teamName);
  }

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



  // Try to get the official team logo URL first (but skip WNBA images)
  const logoUrl = teamAbbr && sport !== 'WNBA' ? getTeamLogoUrl(teamAbbr, sport) : null;

  if (logoUrl) {
    // Use official team logo from ESPN
    return (
      <img 
        src={logoUrl} 
        alt={displayName}
        className={`${sizeClasses[size]} ${className} object-contain`}
        onError={(e) => {
          // If image fails to load, hide it and show fallback
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }



  // Final fallback with team colors
  const fallbackStyle = teamColor 
    ? { 
        background: `linear-gradient(135deg, ${teamColor}, ${teamColor}dd)`,
        borderColor: 'white'
      }
    : {};

  return (
    <div 
      className={`${sizeClasses[size]} ${className} rounded-full ${teamColor ? '' : 'bg-gradient-to-br from-gray-500 to-gray-600'} border-2 border-white shadow-sm flex items-center justify-center`}
      style={fallbackStyle}
    >
      <span className="text-white font-black text-xs">{teamAbbr || displayName.substring(0, 2).toUpperCase()}</span>
    </div>
  );
}