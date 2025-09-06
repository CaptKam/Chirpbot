
export const ALERT_TYPE_CONFIG = {
  MLB: {
    "Game Flow": [
      { key: "MLB_GAME_START", label: "Game Start", description: "Game start notification" }
    ]
  },
  NFL: {
    "Game Flow": [
      { key: "NFL_GAME_START", label: "Game Start", description: "Game kickoff notification" }
    ]
  },
  NBA: {
    "Game Flow": [
      { key: "NBA_GAME_START", label: "Game Start", description: "Game start notification" }
    ]
  },
  NHL: {
    "Game Flow": [
      { key: "NHL_GAME_START", label: "Game Start", description: "Game start notification" }
    ]
  },
  CFL: {
    "Game Flow": [
      { key: "CFL_GAME_START", label: "Game Start", description: "Game kickoff notification" }
    ]
  },
  NCAAF: {
    "Game Flow": [
      { key: "NCAAF_GAME_START", label: "Game Start", description: "Game kickoff notification" }
    ]
  },
  WNBA: {
    "Game Flow": [
      { key: "WNBA_GAME_START", label: "Game Start", description: "Game start notification" }
    ]
  }
};

export type AlertConfigKey = keyof typeof ALERT_TYPE_CONFIG;
export type AlertCategory = keyof typeof ALERT_TYPE_CONFIG[AlertConfigKey];
export interface AlertConfig {
  key: string;
  label: string;
  description: string;
}
