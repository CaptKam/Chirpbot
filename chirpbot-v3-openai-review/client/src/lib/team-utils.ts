/**
 * Removes city names from team names to show only the team name
 * Examples:
 * "Boston Red Sox" -> "Red Sox"
 * "New York Yankees" -> "Yankees"
 * "Los Angeles Angels" -> "Angels"
 * "San Francisco Giants" -> "Giants"
 */
export function removeCity(teamName: string): string {
  if (!teamName) return teamName;
  
  // Common city prefixes to remove
  const cityPrefixes = [
    'New York', 'Los Angeles', 'San Francisco', 'San Diego', 'San Antonio',
    'Boston', 'Chicago', 'Philadelphia', 'Detroit', 'Houston', 'Phoenix',
    'Dallas', 'Miami', 'Atlanta', 'Denver', 'Seattle', 'Portland', 'Orlando',
    'Milwaukee', 'Minneapolis', 'Cleveland', 'Cincinnati', 'Pittsburgh',
    'Baltimore', 'Washington', 'Kansas City', 'St. Louis', 'Tampa Bay',
    'Oakland', 'Colorado', 'Arizona', 'Toronto', 'Montreal', 'Vancouver',
    'Calgary', 'Edmonton', 'Winnipeg', 'Ottawa', 'Buffalo', 'Las Vegas',
    'Nashville', 'Memphis', 'Jacksonville', 'Indianapolis', 'Charlotte',
    'Raleigh', 'Salt Lake City', 'Sacramento', 'Anaheim', 'Green Bay',
    'New Orleans', 'Minnesota', 'Carolina', 'Tennessee', 'Texas'
  ];
  
  // Sort by length (longest first) to match longer city names first
  const sortedPrefixes = cityPrefixes.sort((a, b) => b.length - a.length);
  
  for (const prefix of sortedPrefixes) {
    // Case insensitive match at the beginning of the string
    const regex = new RegExp(`^${prefix}\\s+`, 'i');
    if (regex.test(teamName)) {
      return teamName.replace(regex, '').trim();
    }
  }
  
  return teamName;
}