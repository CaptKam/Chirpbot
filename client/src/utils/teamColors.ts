// Team color mappings for major sports teams
export const getTeamColor = (teamName: string): string => {
  const name = teamName.toLowerCase();
  
  // College Football Teams
  if (name.includes('alabama') || name.includes('crimson')) return '#A50021';
  if (name.includes('auburn') || name.includes('tigers')) return '#0C2340';
  if (name.includes('georgia') || name.includes('bulldogs')) return '#BA0C2F';
  if (name.includes('florida') || name.includes('gators')) return '#0021A5';
  if (name.includes('lsu') || name.includes('tigers')) return '#461D7C';
  if (name.includes('tennessee') || name.includes('volunteers')) return '#FF8200';
  if (name.includes('kentucky') || name.includes('wildcats')) return '#0033A0';
  if (name.includes('south carolina') || name.includes('gamecocks')) return '#73000A';
  if (name.includes('mississippi') || name.includes('rebels')) return '#CE1126';
  if (name.includes('vanderbilt') || name.includes('commodores')) return '#866D4B';
  if (name.includes('texas') || name.includes('longhorns')) return '#BF5700';
  if (name.includes('oklahoma') || name.includes('sooners')) return '#841617';
  if (name.includes('ohio state') || name.includes('buckeyes')) return '#BB0000';
  if (name.includes('michigan') || name.includes('wolverines')) return '#00274C';
  if (name.includes('penn state') || name.includes('nittany')) return '#041E42';
  if (name.includes('wisconsin') || name.includes('badgers')) return '#C5050C';
  if (name.includes('iowa') || name.includes('hawkeyes')) return '#FFCD00';
  if (name.includes('nebraska') || name.includes('cornhuskers')) return '#D00000';
  if (name.includes('michigan state') || name.includes('spartans')) return '#18453B';
  if (name.includes('minnesota') || name.includes('gophers')) return '#7A0019';
  if (name.includes('indiana') || name.includes('hoosiers')) return '#990000';
  if (name.includes('purdue') || name.includes('boilermakers')) return '#CFB991';
  if (name.includes('northwestern') || name.includes('wildcats')) return '#4E2A84';
  if (name.includes('illinois') || name.includes('fighting')) return '#13294B';
  if (name.includes('clemson') || name.includes('tigers')) return '#F66733';
  if (name.includes('florida state') || name.includes('seminoles')) return '#782F40';
  if (name.includes('miami') || name.includes('hurricanes')) return '#F47321';
  if (name.includes('virginia tech') || name.includes('hokies')) return '#861F41';
  if (name.includes('virginia') || name.includes('cavaliers')) return '#232D4B';
  if (name.includes('north carolina') || name.includes('tar heels')) return '#4B9CD3';
  if (name.includes('duke') || name.includes('blue devils')) return '#001A57';
  if (name.includes('notre dame') || name.includes('fighting irish')) return '#0C2340';
  if (name.includes('usc') || name.includes('trojans')) return '#990000';
  if (name.includes('stanford') || name.includes('cardinal')) return '#8C1515';
  if (name.includes('oregon') || name.includes('ducks')) return '#154733';
  if (name.includes('washington') || name.includes('huskies')) return '#4B2E83';
  
  // NFL Teams
  if (name.includes('patriots')) return '#002244';
  if (name.includes('bills')) return '#00338D';
  if (name.includes('dolphins')) return '#008E97';
  if (name.includes('jets')) return '#125740';
  if (name.includes('ravens')) return '#241773';
  if (name.includes('steelers')) return '#FFB612';
  if (name.includes('browns')) return '#311D00';
  if (name.includes('bengals')) return '#FB4F14';
  if (name.includes('titans')) return '#0C2340';
  if (name.includes('colts')) return '#002C5F';
  if (name.includes('texans')) return '#03202F';
  if (name.includes('jaguars')) return '#101820';
  if (name.includes('chiefs')) return '#E31837';
  if (name.includes('chargers')) return '#0080C6';
  if (name.includes('broncos')) return '#FB4F14';
  if (name.includes('raiders')) return '#000000';
  if (name.includes('cowboys')) return '#003594';
  if (name.includes('giants')) return '#0B2265';
  if (name.includes('eagles')) return '#004C54';
  if (name.includes('commanders')) return '#5A1414';
  if (name.includes('packers')) return '#203731';
  if (name.includes('lions')) return '#0076B6';
  if (name.includes('bears')) return '#0B162A';
  if (name.includes('vikings')) return '#4F2683';
  if (name.includes('saints')) return '#D3BC8D';
  if (name.includes('falcons')) return '#A71930';
  if (name.includes('panthers')) return '#0085CA';
  if (name.includes('buccaneers')) return '#D50A0A';
  if (name.includes('49ers')) return '#AA0000';
  if (name.includes('seahawks')) return '#002244';
  if (name.includes('rams')) return '#003594';
  if (name.includes('cardinals')) return '#97233F';
  
  // NBA Teams
  if (name.includes('lakers')) return '#552583';
  if (name.includes('warriors')) return '#1D428A';
  if (name.includes('celtics')) return '#007A33';
  if (name.includes('heat')) return '#98002E';
  if (name.includes('bulls')) return '#CE1141';
  if (name.includes('knicks')) return '#006BB6';
  
  // MLB Teams
  if (name.includes('yankees')) return '#132448';
  if (name.includes('red sox')) return '#BD3039';
  if (name.includes('dodgers')) return '#005A9C';
  if (name.includes('giants')) return '#FD5A1E';
  if (name.includes('cubs')) return '#0E3386';
  if (name.includes('cardinals')) return '#C41E3A';
  
  // Default colors if no match
  return name.includes('away') ? '#60A5FA' : '#FB923C'; // Blue for away, Orange for home
};