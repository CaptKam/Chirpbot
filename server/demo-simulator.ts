import { storage } from "./storage";
import { WebSocket } from "ws";
import type { InsertAlert } from "@shared/schema";
import { analyzeAlert } from "./services/openai";

interface DemoGame {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamShort: string;
  awayTeamShort: string;
  status: string;
  currentInning?: number;
  currentQuarter?: number;
  currentPeriod?: number;
}

interface DemoAlert {
  type: string;
  sport: string;
  title: string;
  description: string;
  gameInfo: any;
  aiContext?: string;
  aiConfidence?: number;
  weatherData?: any;
}

// MLB Batters database
const MLB_BATTERS = [
  { name: "Aaron Judge", team: "NYY", avg: .301, hr: 47, rbi: 125, obp: .406, ops: 1.028, rispAvg: .340 },
  { name: "Shohei Ohtani", team: "LAD", avg: .304, hr: 54, rbi: 130, obp: .390, ops: 1.036, rispAvg: .315 },
  { name: "Freddie Freeman", team: "LAD", avg: .331, hr: 22, rbi: 89, obp: .410, ops: .977, rispAvg: .385 },
  { name: "Mookie Betts", team: "LAD", avg: .289, hr: 19, rbi: 75, obp: .372, ops: .863, rispAvg: .310 },
  { name: "Ronald Acuña Jr.", team: "ATL", avg: .337, hr: 41, rbi: 106, obp: .416, ops: 1.012, rispAvg: .348 },
  { name: "Jose Altuve", team: "HOU", avg: .300, hr: 18, rbi: 70, obp: .364, ops: .808, rispAvg: .322 },
  { name: "Mike Trout", team: "LAA", avg: .263, hr: 18, rbi: 44, obp: .367, ops: .858, rispAvg: .295 },
  { name: "Juan Soto", team: "NYY", avg: .288, hr: 41, rbi: 109, obp: .419, ops: .989, rispAvg: .315 },
];

// Demo alerts templates with realistic data
const DEMO_ALERTS: Record<string, DemoAlert[]> = {
  MLB: [
    {
      type: "RISP",
      sport: "MLB",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "RUNNERS IN SCORING POSITION! 2 outs, bases loaded!",
      gameInfo: {
        inning: "7",
        inningState: "bottom",
        outs: 2,
        balls: 3,
        strikes: 2,
        runners: { first: true, second: true, third: true },
        score: { home: 4, away: 3 },
        scoringProbability: 0.78,
      }
    },
    {
      type: "High Leverage",
      sport: "MLB",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "TIE GAME! Runner on 3rd, 1 out in the 8th!",
      gameInfo: {
        inning: "8",
        inningState: "top",
        outs: 1,
        balls: 2,
        strikes: 1,
        runners: { first: false, second: false, third: true },
        score: { home: 5, away: 5 },
        scoringProbability: 0.65,
      }
    },
    {
      type: "Close Game Alert",
      sport: "MLB",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "ONE-RUN GAME! Bottom 9th, winning run at the plate!",
      gameInfo: {
        inning: "9",
        inningState: "bottom",
        outs: 1,
        balls: 1,
        strikes: 2,
        runners: { first: true, second: false, third: false },
        score: { home: 6, away: 7 },
        scoringProbability: 0.42,
      }
    }
  ],
  NFL: [
    {
      type: "Red Zone",
      sport: "NFL",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "RED ZONE! 1st & Goal from the 8-yard line!",
      gameInfo: {
        quarter: "3",
        timeRemaining: "7:23",
        down: 1,
        yardsToGo: 8,
        fieldPosition: 8,
        possession: "{{awayTeamShort}}",
        score: { home: 17, away: 14 },
        redZone: true,
        tdProbability: 0.68
      }
    },
    {
      type: "4th Down",
      sport: "NFL",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "CRUCIAL 4TH DOWN! 4th & 2 at midfield!",
      gameInfo: {
        quarter: "4",
        timeRemaining: "3:45",
        down: 4,
        yardsToGo: 2,
        fieldPosition: 50,
        possession: "{{homeTeamShort}}",
        score: { home: 21, away: 24 },
        conversionProbability: 0.54
      }
    },
    {
      type: "Two Minute Warning",
      sport: "NFL",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "TWO MINUTE WARNING! 3-point game!",
      gameInfo: {
        quarter: "4",
        timeRemaining: "2:00",
        down: 1,
        yardsToGo: 10,
        fieldPosition: 75,
        possession: "{{awayTeamShort}}",
        score: { home: 27, away: 24 }
      }
    }
  ],
  NBA: [
    {
      type: "Clutch Time",
      sport: "NBA",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "CLUTCH TIME! Under 2 minutes, 3-point game!",
      gameInfo: {
        period: "4",
        timeRemaining: "1:45",
        score: { home: 108, away: 105 },
        possession: "{{homeTeamShort}}",
        shotClock: 14,
        clutchTime: true,
        comebackProbability: 0.42
      }
    },
    {
      type: "Overtime Alert",
      sport: "NBA",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "OVERTIME! Tied at 118!",
      gameInfo: {
        period: "OT",
        timeRemaining: "4:30",
        score: { home: 118, away: 118 },
        overtime: true
      }
    },
    {
      type: "Run Alert",
      sport: "NBA",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "15-2 RUN! Momentum shift in the 3rd quarter!",
      gameInfo: {
        period: "3",
        timeRemaining: "7:12",
        score: { home: 72, away: 85 },
        runDetails: { team: "{{awayTeamShort}}", points: 15, time: "3:00" }
      }
    }
  ],
  NHL: [
    {
      type: "Power Play",
      sport: "NHL",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "POWER PLAY! 5-on-3 advantage!",
      gameInfo: {
        period: "2",
        timeRemaining: "12:45",
        score: { home: 2, away: 2 },
        powerPlay: true,
        advantage: "5-on-3",
        ppTime: "1:45"
      }
    },
    {
      type: "Empty Net",
      sport: "NHL",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "EMPTY NET! Goalie pulled with 90 seconds left!",
      gameInfo: {
        period: "3",
        timeRemaining: "1:30",
        score: { home: 3, away: 4 },
        emptyNet: true,
        pulledGoalie: "{{homeTeamShort}}"
      }
    },
    {
      type: "OT Alert",
      sport: "NHL",
      title: "{{awayTeam}} @ {{homeTeam}}",
      description: "SUDDEN DEATH OVERTIME! Next goal wins!",
      gameInfo: {
        period: "OT",
        timeRemaining: "4:30",
        score: { home: 3, away: 3 },
        overtime: true,
        suddenDeath: true
      }
    }
  ]
};

// Weather conditions for outdoor sports
const WEATHER_CONDITIONS = [
  { temp: 72, condition: "Clear", windSpeed: 5, windDirection: "N" },
  { temp: 78, condition: "Partly Cloudy", windSpeed: 12, windDirection: "SW" },
  { temp: 65, condition: "Overcast", windSpeed: 8, windDirection: "E" },
  { temp: 82, condition: "Sunny", windSpeed: 15, windDirection: "S", note: "Wind blowing out to right field" },
  { temp: 68, condition: "Light Rain", windSpeed: 10, windDirection: "NW" },
  { temp: 75, condition: "Clear", windSpeed: 18, windDirection: "W", note: "Strong crosswind" },
];

export class DemoSimulator {
  private activeGames: Map<string, NodeJS.Timeout> = new Map();
  private demoUserId: string | null = null;
  private alertCount: Map<string, number> = new Map();

  // Start demo mode for a user
  async startDemo(userId: string) {
    this.demoUserId = userId;
    // Clear any existing demo data
    await this.resetDemo();
    console.log(`🎮 Demo mode started for user: ${userId}`);
  }

  // Reset demo data
  async resetDemo() {
    // Stop all active game simulations
    this.activeGames.forEach((timer, gameId) => {
      clearInterval(timer);
    });
    this.activeGames.clear();
    this.alertCount.clear();
    console.log("🔄 Demo data reset");
  }

  // Start monitoring a game (when user clicks on it)
  async startGameMonitoring(gameId: string, userId: string, broadcast: (data: any) => void) {
    // Only work for demo user
    if (userId !== this.demoUserId) return;

    // Stop existing monitoring for this game
    if (this.activeGames.has(gameId)) {
      clearInterval(this.activeGames.get(gameId)!);
    }

    console.log(`🎯 Starting demo monitoring for game: ${gameId}`);
    
    // Parse game info from ID (format: sport-awayTeam-homeTeam)
    const [sport, awayTeamShort, homeTeamShort] = gameId.split('-');
    
    // Get full team names
    const teamNames = this.getTeamNames(sport, awayTeamShort, homeTeamShort);
    
    // Initialize alert count for this game
    if (!this.alertCount.has(gameId)) {
      this.alertCount.set(gameId, 0);
    }

    // Generate first alert immediately
    await this.generateDemoAlert(sport, teamNames, broadcast);

    // Then generate alerts every 8-12 seconds
    const timer = setInterval(async () => {
      await this.generateDemoAlert(sport, teamNames, broadcast);
      
      // Stop after 5 alerts per game
      const count = this.alertCount.get(gameId) || 0;
      if (count >= 5) {
        clearInterval(timer);
        this.activeGames.delete(gameId);
        console.log(`✅ Demo completed for game: ${gameId}`);
      }
    }, 8000 + Math.random() * 4000); // 8-12 second intervals

    this.activeGames.set(gameId, timer);
  }

  // Stop monitoring a game
  stopGameMonitoring(gameId: string, userId: string) {
    if (userId !== this.demoUserId) return;
    
    const timer = this.activeGames.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.activeGames.delete(gameId);
      console.log(`⏹️ Stopped demo monitoring for game: ${gameId}`);
    }
  }

  // Generate a realistic demo alert
  private async generateDemoAlert(sport: string, teamNames: any, broadcast: (data: any) => void) {
    const alerts = DEMO_ALERTS[sport] || DEMO_ALERTS.MLB;
    const alertTemplate = alerts[Math.floor(Math.random() * alerts.length)];
    
    // Clone and customize the alert
    const alert = JSON.parse(JSON.stringify(alertTemplate));
    alert.title = alert.title
      .replace('{{homeTeam}}', teamNames.homeTeam)
      .replace('{{awayTeam}}', teamNames.awayTeam);
    
    // Add realistic batter data for MLB
    if (sport === 'MLB') {
      const batter = MLB_BATTERS[Math.floor(Math.random() * MLB_BATTERS.length)];
      alert.gameInfo.currentBatter = {
        id: Math.floor(Math.random() * 1000000),
        name: batter.name,
        batSide: Math.random() > 0.7 ? "L" : "R",
        stats: {
          avg: batter.avg,
          hr: batter.hr,
          rbi: batter.rbi,
          obp: batter.obp,
          ops: batter.ops
        }
      };
      
      // Add AI context with batter info
      const weather = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
      alert.aiContext = `${batter.name} batting (${batter.avg} AVG, ${batter.hr} HRs). `;
      alert.aiContext += `Season RISP: ${batter.rispAvg}. `;
      if (weather.note) {
        alert.aiContext += weather.note + ". ";
      }
      alert.aiContext += `Historical success rate in this situation: ${Math.floor(35 + Math.random() * 30)}%.`;
      alert.weatherData = {
        temperature: weather.temp,
        condition: weather.condition,
        windSpeed: weather.windSpeed,
        windDirection: weather.windDirection
      };
    } else if (sport === 'NFL') {
      alert.aiContext = `${teamNames.awayTeamShort} converts ${Math.floor(60 + Math.random() * 30)}% in red zone. `;
      alert.aiContext += `QB completion rate under pressure: ${Math.floor(55 + Math.random() * 20)}%. `;
      alert.aiContext += `Defense allows ${(3.5 + Math.random() * 2).toFixed(1)} YPC in 4th quarter.`;
    } else if (sport === 'NBA') {
      alert.aiContext = `Clutch time FG%: Home ${Math.floor(40 + Math.random() * 15)}%, Away ${Math.floor(40 + Math.random() * 15)}%. `;
      alert.aiContext += `Last 5 meetings: ${Math.random() > 0.5 ? teamNames.homeTeamShort : teamNames.awayTeamShort} 3-2. `;
      alert.aiContext += `Key player efficiency rating: ${(20 + Math.random() * 10).toFixed(1)}.`;
    } else if (sport === 'NHL') {
      alert.aiContext = `Power play conversion: ${Math.floor(15 + Math.random() * 15)}% this season. `;
      alert.aiContext += `Goalie save % in 3rd period: .${Math.floor(900 + Math.random() * 50)}. `;
      alert.aiContext += `Face-off win rate: ${Math.floor(45 + Math.random() * 15)}%.`;
    }

    alert.aiConfidence = Math.floor(75 + Math.random() * 20);
    
    // Update game info with team names
    alert.gameInfo.homeTeam = teamNames.homeTeam;
    alert.gameInfo.awayTeam = teamNames.awayTeam;
    alert.gameInfo.status = "Live";
    
    // Create the alert
    const createdAlert = await storage.createAlert({
      ...alert,
      sentToTelegram: false
    });
    
    // Broadcast to WebSocket
    broadcast({ type: 'new_alert', data: createdAlert });
    
    // Update count
    const gameId = `${sport}-${teamNames.awayTeamShort}-${teamNames.homeTeamShort}`;
    this.alertCount.set(gameId, (this.alertCount.get(gameId) || 0) + 1);
    
    console.log(`📢 Demo alert generated for ${alert.title}: ${alert.type}`);
  }

  // Get full team names from abbreviations
  private getTeamNames(sport: string, awayTeamShort: string, homeTeamShort: string) {
    const teamMap: Record<string, Record<string, string>> = {
      MLB: {
        NYY: "Yankees", BOS: "Red Sox", LAD: "Dodgers", SF: "Giants",
        SD: "Padres", LAA: "Angels", HOU: "Astros", ATL: "Braves",
        CHC: "Cubs", STL: "Cardinals", PHI: "Phillies", NYM: "Mets"
      },
      NFL: {
        KC: "Chiefs", BUF: "Bills", DAL: "Cowboys", PHI: "Eagles",
        SF: "49ers", GB: "Packers", NE: "Patriots", MIA: "Dolphins",
        LAR: "Rams", CIN: "Bengals", BAL: "Ravens", PIT: "Steelers"
      },
      NBA: {
        LAL: "Lakers", BOS: "Celtics", GSW: "Warriors", MIA: "Heat",
        PHI: "76ers", MIL: "Bucks", PHO: "Suns", DEN: "Nuggets",
        DAL: "Mavericks", LAC: "Clippers", BKN: "Nets", NYK: "Knicks"
      },
      NHL: {
        NYR: "Rangers", BOS: "Bruins", TOR: "Maple Leafs", MTL: "Canadiens",
        COL: "Avalanche", VGK: "Golden Knights", TB: "Lightning", FLA: "Panthers",
        EDM: "Oilers", CAL: "Flames", VAN: "Canucks", SEA: "Kraken"
      }
    };

    const teams = teamMap[sport] || teamMap.MLB;
    return {
      homeTeam: teams[homeTeamShort] || homeTeamShort,
      awayTeam: teams[awayTeamShort] || awayTeamShort,
      homeTeamShort,
      awayTeamShort
    };
  }

  // Stop all demo activities
  stopDemo() {
    this.resetDemo();
    this.demoUserId = null;
    console.log("🛑 Demo mode stopped");
  }
}

// Export singleton instance
export const demoSimulator = new DemoSimulator();