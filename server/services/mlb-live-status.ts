/**
 * Unified MLB Live Status Detection
 * Fixes timezone and live state detection issues
 */

// Universal live status helper - use everywhere
export function isLiveStatus(game: any): boolean {
  const abs = (game?.status?.abstractGameState ?? game?.abstractGameState ?? "").trim();
  const coded = (game?.status?.codedGameState ?? game?.codedGameState ?? "").trim();
  const text = (game?.status?.detailedState ?? game?.detailedState ?? "").toLowerCase();
  
  return abs === "Live" || coded === "I" || text === "in progress" || text === "live";
}

// Eastern timezone helper for MLB dates
export function getMLBDateET(): string {
  // Force Eastern timezone for MLB scheduling
  const et = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit", 
    day: "2-digit"
  });
  
  const [month, day, year] = et.split('/');
  return `${year}-${month}-${day}`;
}

// Enhanced MLB API URL with proper timezone
export function buildMLBScheduleURL(dateParam?: string): string {
  const date = dateParam || getMLBDateET();
  
  return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,game(content(all)),metadata,seriesStatus,seriesSummary,team,team.league,team.division,venue,gameInfo,flags,liveLookin,review`;
}