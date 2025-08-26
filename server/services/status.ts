// Robust, shared live status detection
export function isLiveStatus(s: any): boolean {
  const abs = (s?.abstractGameState ?? "").trim();
  const coded = (s?.codedGameState ?? "").trim();
  const text = (s?.detailedState ?? s?.status ?? "").toLowerCase();
  return abs === "Live" || coded === "I" || text === "live" || text.includes("in progress");
}