// Stadium metadata for enhanced weather calculations
// CF azimuth = centerfield direction from home plate in degrees
// Roof types: "open" | "closed" | "retractable"

export const STADIUMS: Record<string, { 
  lat: number; 
  lon: number; 
  cfAzimuthDeg: number; 
  roof?: "open" | "closed" | "retractable" 
}> = {
  // American League East
  "yankee-stadium": { lat: 40.8296, lon: -73.9262, cfAzimuthDeg: 280, roof: "open" },
  "fenway-park": { lat: 42.3467, lon: -71.0972, cfAzimuthDeg: 310, roof: "open" },
  "rogers-centre": { lat: 43.6414, lon: -79.3894, cfAzimuthDeg: 270, roof: "retractable" },
  "tropicana-field": { lat: 27.7682, lon: -82.6534, cfAzimuthDeg: 315, roof: "closed" },
  "oriole-park": { lat: 39.2840, lon: -76.6218, cfAzimuthDeg: 354, roof: "open" },

  // American League Central  
  "guaranteed-rate-field": { lat: 41.8300, lon: -87.6338, cfAzimuthDeg: 347, roof: "open" },
  "progressive-field": { lat: 41.4958, lon: -81.6852, cfAzimuthDeg: 325, roof: "open" },
  "comerica-park": { lat: 42.3391, lon: -83.0485, cfAzimuthDeg: 339, roof: "open" },
  "kauffman-stadium": { lat: 39.0517, lon: -94.4803, cfAzimuthDeg: 8, roof: "open" },
  "target-field": { lat: 44.9817, lon: -93.2776, cfAzimuthDeg: 195, roof: "open" },

  // American League West
  "angel-stadium": { lat: 33.8003, lon: -117.8827, cfAzimuthDeg: 230, roof: "open" },
  "minute-maid-park": { lat: 29.7571, lon: -95.3550, cfAzimuthDeg: 25, roof: "retractable" },
  "oakland-coliseum": { lat: 37.7516, lon: -122.2005, cfAzimuthDeg: 285, roof: "open" },
  "t-mobile-park": { lat: 47.5914, lon: -122.3326, cfAzimuthDeg: 215, roof: "retractable" },
  "globe-life-field": { lat: 32.7472, lon: -97.0825, cfAzimuthDeg: 13, roof: "retractable" },

  // National League East
  "nationals-park": { lat: 38.8730, lon: -77.0074, cfAzimuthDeg: 295, roof: "open" },
  "citizens-bank-park": { lat: 39.9061, lon: -75.1665, cfAzimuthDeg: 320, roof: "open" },
  "citi-field": { lat: 40.7571, lon: -73.8458, cfAzimuthDeg: 285, roof: "open" },
  "truist-park": { lat: 33.8902, lon: -84.4677, cfAzimuthDeg: 300, roof: "open" },
  "loanDepot-park": { lat: 25.7781, lon: -80.2195, cfAzimuthDeg: 346, roof: "retractable" },

  // National League Central
  "wrigley-field": { lat: 41.9484, lon: -87.6553, cfAzimuthDeg: 355, roof: "open" },
  "great-american-ball-park": { lat: 39.0975, lon: -84.5068, cfAzimuthDeg: 325, roof: "open" },
  "american-family-field": { lat: 43.0280, lon: -87.9712, cfAzimuthDeg: 200, roof: "retractable" },
  "pnc-park": { lat: 40.4469, lon: -80.0057, cfAzimuthDeg: 320, roof: "open" },
  "busch-stadium": { lat: 38.6226, lon: -90.1928, cfAzimuthDeg: 345, roof: "open" },

  // National League West
  "coors-field": { lat: 39.7559, lon: -104.9942, cfAzimuthDeg: 347, roof: "open" },
  "chase-field": { lat: 33.4453, lon: -112.0667, cfAzimuthDeg: 338, roof: "retractable" },
  "petco-park": { lat: 32.7073, lon: -117.1566, cfAzimuthDeg: 285, roof: "open" },
  "oracle-park": { lat: 37.7786, lon: -122.3893, cfAzimuthDeg: 310, roof: "open" },
  "dodger-stadium": { lat: 34.0739, lon: -118.2400, cfAzimuthDeg: 295, roof: "open" }
};

// Stadium name mapping for venue resolution
export const VENUE_MAPPINGS: Record<string, string> = {
  "Yankee Stadium": "yankee-stadium",
  "Fenway Park": "fenway-park", 
  "Rogers Centre": "rogers-centre",
  "Tropicana Field": "tropicana-field",
  "Oriole Park at Camden Yards": "oriole-park",
  "Guaranteed Rate Field": "guaranteed-rate-field",
  "Progressive Field": "progressive-field",
  "Comerica Park": "comerica-park",
  "Kauffman Stadium": "kauffman-stadium",
  "Target Field": "target-field",
  "Angel Stadium": "angel-stadium",
  "Minute Maid Park": "minute-maid-park",
  "Oakland Coliseum": "oakland-coliseum",
  "T-Mobile Park": "t-mobile-park",
  "Globe Life Field": "globe-life-field",
  "Nationals Park": "nationals-park",
  "Citizens Bank Park": "citizens-bank-park",
  "Citi Field": "citi-field",
  "Truist Park": "truist-park",
  "loanDepot park": "loanDepot-park",
  "Wrigley Field": "wrigley-field",
  "Great American Ball Park": "great-american-ball-park",
  "American Family Field": "american-family-field",
  "PNC Park": "pnc-park",
  "Busch Stadium": "busch-stadium",
  "Coors Field": "coors-field",
  "Chase Field": "chase-field",
  "Petco Park": "petco-park",
  "Oracle Park": "oracle-park",
  "Dodger Stadium": "dodger-stadium"
};

export function getStadiumKey(venueName: string): string | null {
  return VENUE_MAPPINGS[venueName] || null;
}