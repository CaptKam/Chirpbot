export interface Team {
  id: string;
  name: string;
  initials: string;
  sport: string;
  logoColor: string;
  monitored: boolean;
  externalId?: string | null;
}

export interface Alert {
  id: string;
  type: string;
  sport: string;
  title: string;
  description: string;
  aiContext?: string | null;
  aiConfidence?: number | null;
  priority?: number;
  gameInfo: {
    homeTeam: string;
    awayTeam: string;
    quarter?: string;
    inning?: string;
    period?: string;
    status: string;
  };
  weatherData?: {
    temperature: number;
    condition: string;
    windSpeed?: number;
    windDirection?: string;
  } | null;
  timestamp: string;
  sentToTelegram: boolean;
}

export interface Settings {
  id: string;
  sport: string;
  alertTypes: {
    risp?: boolean;
    homeRun?: boolean;
    lateInning?: boolean;
    redZone?: boolean;
    clutchTime?: boolean;
  };
  aiEnabled: boolean;
  aiConfidenceThreshold: number;
  telegramEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

export interface WebSocketMessage {
  type: 'new_alert' | 'team_monitoring_changed' | 'settings_changed';
  data: Alert | Team | Settings;
}
