import { storage } from "./storage";
import { InsertAlert } from "@shared/schema";

interface DemoGame {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
}

interface DemoAlert {
  type: string;
  sport: string;
  title: string;
  description: string;
  aiContext: string;
  aiConfidence: number;
  gameInfo: any;
  weatherData: any;
}

export class DemoAlertSimulator {
  private static DEMO_USER_ID: string | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;
  private lastAlertTime = 0;
  private alertCounter = 0;

  // Demo alert templates for different sports
  private demoAlertTemplates = {
    MLB: [
      {
        type: "RISP Alert",
        getAlert: (game: DemoGame) => ({
          description: `🔥 BASES LOADED! 2 outs in the bottom 9th! ${this.getRandomPlayer(game.homeTeam, "MLB")} at the plate (.312 BA, 28 HRs)`,
          aiContext: `Historic clutch situation - ${game.homeTeam} has 67% success rate with bases loaded this season. Wind blowing out at 12 MPH.`,
          aiConfidence: 89,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            inning: "9",
            inningState: "bottom" as const,
            outs: 2,
            balls: 1,
            strikes: 2,
            runners: { first: true, second: true, third: true },
            score: { home: 4, away: 5 },
            status: "Live",
            priority: 95,
            scoringProbability: 78
          }
        })
      },
      {
        type: "Late Inning Pressure",
        getAlert: (game: DemoGame) => ({
          description: `⚠️ GAME ON THE LINE! Top 8th, runner on 3rd with 1 out. ${this.getRandomPlayer(game.awayTeam, "MLB")} (.289 BA) vs closer`,
          aiContext: `${game.homeTeam}'s closer has 1.89 ERA but allows .298 BA with RISP. High leverage situation developing.`,
          aiConfidence: 82,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            inning: "8",
            inningState: "top" as const,
            outs: 1,
            balls: 2,
            strikes: 1,
            runners: { first: false, second: false, third: true },
            score: { home: 6, away: 6 },
            status: "Live",
            priority: 87,
            scoringProbability: 65
          }
        })
      },
      {
        type: "Close Game",
        getAlert: (game: DemoGame) => ({
          description: `🎯 TIE GAME! ${game.awayTeam} just tied it up 3-3 in the 7th! ${this.getRandomPlayer(game.homeTeam, "MLB")} coming to bat`,
          aiContext: `Game momentum shift detected. ${game.homeTeam} bullpen ERA drops to 2.45 in tie games. Weather conditions favor hitters.`,
          aiConfidence: 76,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            inning: "7",
            inningState: "bottom" as const,
            outs: 0,
            balls: 0,
            strikes: 0,
            runners: { first: false, second: false, third: false },
            score: { home: 3, away: 3 },
            status: "Live",
            priority: 78,
            scoringProbability: 52
          }
        })
      }
    ],
    NFL: [
      {
        type: "Red Zone Alert",
        getAlert: (game: DemoGame) => ({
          description: `🚨 RED ZONE! ${game.awayTeam} 1st & Goal at the 8-yard line! ${this.getRandomPlayer(game.awayTeam, "NFL")} targeting the end zone`,
          aiContext: `${game.awayTeam} converts 73% of red zone opportunities. Defense allows 1.2 TDs per red zone visit. High-scoring drive likely.`,
          aiConfidence: 91,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            quarter: "3",
            status: "Live",
            score: { home: 14, away: 10 },
            priority: 92,
            scoringProbability: 85
          }
        })
      },
      {
        type: "Fourth Down",
        getAlert: (game: DemoGame) => ({
          description: `⚡ 4TH & 3! ${game.homeTeam} going for it at midfield! ${this.getRandomPlayer(game.homeTeam, "NFL")} under center`,
          aiContext: `Coach's aggressive decision - 67% conversion rate on 4th & short this season. Game-changing moment in 4th quarter.`,
          aiConfidence: 85,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            quarter: "4",
            status: "Live",
            score: { home: 21, away: 24 },
            priority: 88,
            scoringProbability: 68
          }
        })
      },
      {
        type: "Two Minute Warning",
        getAlert: (game: DemoGame) => ({
          description: `🕐 TWO MINUTE WARNING! ${game.awayTeam} down by 3, driving at the ${game.homeTeam} 35-yard line!`,
          aiContext: `Critical drive with championship implications. ${game.awayTeam} QB has 4 TDs, 0 INTs in two-minute drills this season.`,
          aiConfidence: 93,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            quarter: "4",
            status: "Live",
            score: { home: 28, away: 25 },
            priority: 96,
            scoringProbability: 78
          }
        })
      }
    ],
    NBA: [
      {
        type: "Clutch Time",
        getAlert: (game: DemoGame) => ({
          description: `🔥 CLUTCH TIME! Under 2 minutes, ${game.homeTeam} up by 1! ${this.getRandomPlayer(game.homeTeam, "NBA")} with the ball`,
          aiContext: `${game.homeTeam} shoots 47% in clutch situations. ${game.awayTeam} allowing 1.08 PPP in final 2 minutes this season.`,
          aiConfidence: 84,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            quarter: "4",
            status: "Live",
            score: { home: 108, away: 107 },
            priority: 90,
            scoringProbability: 52
          }
        })
      },
      {
        type: "Close Game",
        getAlert: (game: DemoGame) => ({
          description: `⚡ 3-POINT GAME! ${game.awayTeam} cut the lead to 3 with 5:30 left! Momentum shifting!`,
          aiContext: `Game momentum indicator: ${game.awayTeam} on 12-4 run. ${game.homeTeam} calling timeout to stop the bleeding.`,
          aiConfidence: 79,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            quarter: "4",
            status: "Live",
            score: { home: 95, away: 92 },
            priority: 82,
            scoringProbability: 56
          }
        })
      }
    ],
    NHL: [
      {
        type: "Power Play",
        getAlert: (game: DemoGame) => ({
          description: `⚡ POWER PLAY! ${game.awayTeam} man advantage with 8:45 left in 3rd! ${this.getRandomPlayer(game.awayTeam, "NHL")} controlling the puck`,
          aiContext: `${game.awayTeam} power play converts at 24.5% this season. ${game.homeTeam} penalty kill struggling lately at 76.2%.`,
          aiConfidence: 87,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            period: "3",
            status: "Live",
            score: { home: 2, away: 1 },
            priority: 85,
            scoringProbability: 73
          }
        })
      },
      {
        type: "Close Game",
        getAlert: (game: DemoGame) => ({
          description: `🥅 TIE GAME! ${game.homeTeam} just scored to tie it 2-2 with 12:15 left! Ice tilting!`,
          aiContext: `Game momentum completely shifted. ${game.homeTeam} dominating shots 15-4 this period. Overtime potential rising.`,
          aiConfidence: 81,
          gameInfo: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            period: "3",
            status: "Live",
            score: { home: 2, away: 2 },
            priority: 83,
            scoringProbability: 50
          }
        })
      }
    ]
  };

  private randomPlayers = {
    MLB: ["Judge", "Ohtani", "Betts", "Freeman", "Harper", "Machado", "Tatis Jr.", "Soto", "Acuña Jr.", "Alvarez"],
    NFL: ["Mahomes", "Allen", "Herbert", "Burrow", "Jackson", "Wilson", "Murray", "Watson", "Rodgers", "Brady"],
    NBA: ["LeBron", "Curry", "Durant", "Giannis", "Jokić", "Tatum", "Luka", "Embiid", "Kawhi", "Davis"],
    NHL: ["McDavid", "Draisaitl", "MacKinnon", "Pastrnak", "Kucherov", "Ovechkin", "Crosby", "Hedman", "Fox", "Makar"]
  };

  private getRandomPlayer(team: string, sport: string): string {
    const players = this.randomPlayers[sport as keyof typeof this.randomPlayers] || [];
    return players[Math.floor(Math.random() * players.length)];
  }

  private getRandomWeather() {
    const conditions = [
      { condition: "Clear", temperature: 72, windSpeed: 8, windDirection: "SW" },
      { condition: "Partly Cloudy", temperature: 68, windSpeed: 12, windDirection: "W" },
      { condition: "Overcast", temperature: 65, windSpeed: 5, windDirection: "NW" },
      { condition: "Light Rain", temperature: 58, windSpeed: 15, windDirection: "E" },
      { condition: "Windy", temperature: 70, windSpeed: 18, windDirection: "S" }
    ];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  async startSimulation(demoUserId: string) {
    DemoAlertSimulator.DEMO_USER_ID = demoUserId;
    console.log(`🎯 Starting demo alert simulation for user: ${demoUserId}`);
    
    // Stop any existing simulation
    this.stopSimulation();
    
    // Start simulation with random intervals between 15-45 seconds
    this.simulationInterval = setInterval(async () => {
      await this.generateDemoAlert();
    }, 20000 + Math.random() * 25000); // 20-45 seconds
  }

  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      console.log("🛑 Demo alert simulation stopped");
    }
  }

  private async generateDemoAlert() {
    if (!DemoAlertSimulator.DEMO_USER_ID) return;

    try {
      // Get the demo user's monitored games
      const monitoredGames = await storage.getUserMonitoredGames(DemoAlertSimulator.DEMO_USER_ID);
      
      if (monitoredGames.length === 0) {
        console.log("🎯 No monitored games for demo user - skipping alert generation");
        return;
      }

      // Select a random monitored game
      const randomGame = monitoredGames[Math.floor(Math.random() * monitoredGames.length)];
      const sport = randomGame.sport as keyof typeof this.demoAlertTemplates;
      
      if (!this.demoAlertTemplates[sport]) {
        console.log(`🎯 No demo templates for sport: ${sport}`);
        return;
      }

      // Select a random alert template for this sport
      const templates = this.demoAlertTemplates[sport];
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      // Generate the alert using the template
      const alertData = template.getAlert({
        id: randomGame.gameId,
        sport: randomGame.sport,
        homeTeam: randomGame.homeTeamName,
        awayTeam: randomGame.awayTeamName
      });

      // Create the demo alert
      const insertAlert: InsertAlert = {
        type: template.type,
        sport: randomGame.sport,
        title: `${randomGame.awayTeamName} @ ${randomGame.homeTeamName}`,
        description: alertData.description,
        aiContext: alertData.aiContext,
        aiConfidence: alertData.aiConfidence,
        gameInfo: alertData.gameInfo,
        weatherData: this.getRandomWeather(),
        sentToTelegram: false
      };

      // Save to database
      const createdAlert = await storage.createAlert(insertAlert);
      
      console.log(`🎯 Generated demo alert: ${template.type} for ${randomGame.awayTeamName} @ ${randomGame.homeTeamName}`);
      
      // Broadcast to WebSocket clients (this would be handled by the main alerting system)
      // The existing WebSocket broadcasting in routes.ts will pick this up automatically
      
      this.alertCounter++;
      
    } catch (error) {
      console.error("❌ Error generating demo alert:", error);
    }
  }

  static async getDemoUserId(): Promise<string | null> {
    try {
      const demoUser = await storage.getUserByUsername("Demo");
      return demoUser?.id || null;
    } catch (error) {
      console.error("❌ Error getting demo user ID:", error);
      return null;
    }
  }

  static isDemoUser(userId: string): boolean {
    return DemoAlertSimulator.DEMO_USER_ID === userId;
  }
}

export const demoSimulator = new DemoAlertSimulator();