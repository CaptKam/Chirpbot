import { useState } from 'react';

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

// Team primary colors by sport and abbreviation
const teamColors: Record<string, Record<string, string>> = {
  'NFL': {
    'ARI': '#97233F', 'ATL': '#A71930', 'BAL': '#241773', 'BUF': '#00338D',
    'CAR': '#0085CA', 'CHI': '#C83803', 'CIN': '#FB4F14', 'CLE': '#311D00',
    'DAL': '#003594', 'DEN': '#FB4F14', 'DET': '#0076B6', 'GB': '#203731',
    'HOU': '#03202F', 'IND': '#002C5F', 'JAX': '#006778', 'JAC': '#006778', 'KC': '#E31837',
    'LAC': '#0080C6', 'LAR': '#003594', 'LA': '#003594', 'LV': '#000000', 'MIA': '#008E97',
    'MIN': '#4F2683', 'NE': '#002244', 'NO': '#D3BC8D', 'NYG': '#0B2265',
    'NYJ': '#125740', 'PHI': '#004C54', 'PIT': '#FFB612', 'SEA': '#002244',
    'SF': '#AA0000', 'TB': '#D50A0A', 'TEN': '#0C2340', 'WAS': '#5A1414', 'WSH': '#5A1414'
  },
  'MLB': {
    'ARI': '#A71930', 'AZ': '#A71930', 'ATL': '#CE1141', 'BAL': '#DF4601', 'BOS': '#BD3039',
    'CHC': '#0E3386', 'CWS': '#27251F', 'CHW': '#27251F', 'CIN': '#C6011F', 'CLE': '#E31937',
    'COL': '#33006F', 'DET': '#0C2C56', 'HOU': '#EB6E1F', 'KC': '#004687',
    'LAA': '#BA0021', 'LAD': '#005A9C', 'MIA': '#00A3E0', 'MIL': '#FFC52F',
    'MIN': '#002B5C', 'NYM': '#002D72', 'NYY': '#003087', 'OAK': '#003831', 'ATH': '#003831',
    'PHI': '#E81828', 'PIT': '#FDB827', 'SD': '#2F241D', 'SEA': '#0C2C56',
    'SF': '#FD5A1E', 'STL': '#C41E3A', 'TB': '#092C5C', 'TEX': '#003278',
    'TOR': '#134A8E', 'WSH': '#AB0003'
  },
  'NBA': {
    'ATL': '#E03A3E', 'BOS': '#007A33', 'BKN': '#000000', 'CHA': '#1D1160', 'CHO': '#1D1160',
    'CHI': '#CE1141', 'CLE': '#860038', 'DAL': '#00538C', 'DEN': '#0E2240',
    'DET': '#C8102E', 'GS': '#1D428A', 'GSW': '#1D428A', 'HOU': '#CE1141', 'IND': '#002D62',
    'LAC': '#C8102E', 'LAL': '#552583', 'MEM': '#5D76A9', 'MIA': '#98002E',
    'MIL': '#00471B', 'MIN': '#0C2340', 'NO': '#0C2340', 'NOP': '#0C2340', 'NY': '#006BB6', 'NYK': '#006BB6',
    'OKC': '#007AC1', 'OKL': '#007AC1', 'ORL': '#0077C0', 'PHI': '#006BB6', 'PHX': '#1D1160',
    'POR': '#E03A3E', 'SAC': '#5A2D81', 'SA': '#C4CED4', 'SAS': '#C4CED4', 'TOR': '#CE1141',
    'UTA': '#002B5C', 'UTAH': '#002B5C', 'WAS': '#002B5C', 'WSH': '#002B5C',
    'GUANGZHOU': '#FF0000'
  },
  'NCAAF': {
    // SEC
    'BAMA': '#9E1B32', 'ALA': '#9E1B32', 'AUB': '#0C2340', 'UGA': '#BA0C2F', 'LSU': '#461D7C',
    'FLA': '#0021A5', 'TENN': '#FF8200', 'UK': '#0033A0', 'SCAR': '#73000A',
    'MISS': '#14213D', 'TAMU': '#500000', 'ARK': '#9D2235', 'MIST': '#5D1725', 'MSU': '#5D1725',
    'VANDY': '#866D4B', 'MIZZ': '#F1B82D', 'MIZ': '#F1B82D',
    // Big Ten
    'OHIO': '#BB0000', 'OSU': '#BB0000', 'MICH': '#00274C', 'PSU': '#041E42', 'WISC': '#C5050C', 
    'IOWA': '#FFCD00', 'NEB': '#E41C38', 'MINN': '#7A0019', 'ILL': '#13294B', 
    'NW': '#4E2A84', 'NU': '#4E2A84', 'IND': '#990000', 'IU': '#990000',
    'PUR': '#CEB888', 'MD': '#E03A3E', 'RUTG': '#CC0033',
    // ACC & Independent
    'ND': '#0C2340', 'CLEM': '#F66733', 'FSU': '#782F40', 'MIAMI': '#F47321', 'UNC': '#7BAFD4',
    'NCSU': '#CC0000', 'UVA': '#232D4B', 'VT': '#630031', 'PITT': '#003594',
    'LOU': '#AD0000', 'BC': '#8B0000', 'GT': '#B3A369', 'DUKE': '#003087',
    'WAKE': '#9E7E38', 'SYR': '#D44500', 'ARMY': '#000000', 'NAVY': '#00205B',
    // Big 12
    'TEX': '#BF5700', 'OU': '#841617', 'OKST': '#FF7300', 'TCU': '#4D1979',
    'TTU': '#CC0000', 'BAYLOR': '#154734', 'KU': '#0051BA', 'KSU': '#512888',
    'ISU': '#C8102E', 'WVU': '#002855', 'BYU': '#002E5D', 'UCF': '#000000', 
    'CIN': '#E00122', 'HOU': '#C8102E',
    // Pac-12
    'USC': '#990000', 'UCLA': '#2D68C4', 'ORE': '#154733', 'WASH': '#4B2E83',
    'ORST': '#DC4405', 'UTAH': '#CC0000', 'CU': '#CFB87C', 'COLO': '#CFB87C', 'ASU': '#8C1D40',
    'STAN': '#8C1515', 'CAL': '#003262', 'WSU': '#A60F2D',
    // Other conferences
    'SDSU': '#A6192E', 'SMU': '#C8102E', 'JMU': '#450084', 'UL': '#CE181E',
    'CLT': '#005035', 'AKR': '#041E42', 'M-OH': '#C8102E', 'BGSU': '#FE5000',
    'TOL': '#15397F', 'EMU': '#006633', 'NIU': '#BA0C2F', 'KENT': '#002664',
    'MASS': '#881C1C', 'GAST': '#0039A6', 'APP': '#222222', 'MRSH': '#00B140',
    'ODU': '#003057', 'WMU': '#421C08', 'BALL': '#BA0C2F', 'TEM': '#9D2235',
    'FAU': '#003366', 'UAB': '#1E6B52', 'AFA': '#003087', 'UNLV': '#CF0A2C'
  },
  'WNBA': {
    'ATL': '#C8102E', 'CHI': '#418FDE', 'CONN': '#C4D600', 'DAL': '#0C2340',
    'IND': '#E03A3E', 'LA': '#702F8A', 'LV': '#000000', 'MIN': '#266092',
    'NY': '#6ECEB2', 'PHX': '#CB6015', 'SEA': '#2C5234', 'WAS': '#C8102E'
  },
  'CFL': {
    'BC': '#F05323', 'CGY': '#CE1126', 'EDM': '#00573F', 'SSK': '#006341',
    'WPG': '#041E42', 'HAM': '#FFB81C', 'TOR': '#00205B', 'OTT': '#C8102E',
    'MTL': '#00205B'
  }
};

// Get team color by abbreviation and sport
function getTeamColor(abbreviation: string | undefined, sport: string | undefined): string | undefined {
  if (!abbreviation || !sport) return undefined;
  
  // Normalize both sport and abbreviation to uppercase for consistent lookup
  const normalizedSport = sport.toUpperCase().trim();
  const normalizedAbbr = abbreviation.toUpperCase().trim();
  
  const sportColors = teamColors[normalizedSport];
  if (!sportColors) return undefined;
  
  return sportColors[normalizedAbbr];
}

export function TeamLogo({ teamName, abbreviation, sport, size = 'md', className = '', teamColor }: TeamLogoProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  
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

  // Use provided teamColor or look up by abbreviation/sport
  const resolvedColor = teamColor || getTeamColor(teamAbbr, sport);

  // DEBUG: Log color resolution (DEV only)
  if (import.meta.env.DEV && !logoUrl) {
    console.log(`🎨 TeamLogo [${sport}]:`, {
      teamName,
      rawAbbr: abbreviation,
      resolvedAbbr: teamAbbr,
      normalizedAbbr: teamAbbr?.toUpperCase().trim(),
      hasColor: !!resolvedColor,
      color: resolvedColor,
      willShowGray: !resolvedColor
    });
  }

  // If we have a logo URL and it hasn't failed to load, show the image
  if (logoUrl && !imageLoadFailed) {
    return (
      <img 
        src={logoUrl} 
        alt={displayName}
        className={`${sizeClasses[size]} ${className} object-contain`}
        onError={() => {
          // If image fails to load, switch to colored fallback
          setImageLoadFailed(true);
        }}
      />
    );
  }

  // Show colored team circle fallback (either no logo URL or image failed to load)
  // Use inline styles for background to avoid Tailwind CSS specificity conflicts
  const fallbackStyle = resolvedColor 
    ? { 
        background: `linear-gradient(135deg, ${resolvedColor}, ${resolvedColor}dd)`
      }
    : {
        background: 'linear-gradient(135deg, rgb(107, 114, 128), rgb(75, 85, 99))'
      };

  return (
    <div 
      className={`${sizeClasses[size]} ${className} rounded-full border-2 border-white shadow-sm flex items-center justify-center`}
      style={fallbackStyle}
    >
      <span className="text-white font-black text-xs">{teamAbbr || displayName.substring(0, 2).toUpperCase()}</span>
    </div>
  );
}