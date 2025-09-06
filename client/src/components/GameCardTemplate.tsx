import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, TrendingUp, Zap, Info, Star, Users, Award, Target } from "lucide-react";
import { GameCardProps } from "../types";

interface Player {
  id: number;
  name: string;
  team: string;
  position: string;
  stats: {
    [key: string]: string | number;
  };
}

interface Team {
  id: number;
  name: string;
  city: string;
  logo: string;
}

interface Game {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  time: string;
  location: string;
  status: "Scheduled" | "Live" | "Final";
  homeScore?: number;
  awayScore?: number;
  players?: Player[];
  weather?: {
    temperature: string;
    condition: string;
    icon: string;
  };
}

const games: Game[] = [
  {
    id: 1,
    homeTeam: { id: 1, name: "Eagles", city: "Philadelphia", logo: "/eagles.png" },
    awayTeam: { id: 2, name: "Giants", city: "New York", logo: "/giants.png" },
    date: "2025-09-01",
    time: "1:00 PM",
    location: "Lincoln Financial Field",
    status: "Final",
    homeScore: 24,
    awayScore: 17,
    players: [
      { id: 101, name: "Jalen Hurts", team: "Eagles", position: "QB", stats: { passing: "250 yds", touchdowns: 2 } },
      { id: 102, name: "Saquon Barkley", team: "Giants", position: "RB", stats: { rushing: "80 yds", touchdowns: 1 } },
    ],
  },
  {
    id: 2,
    homeTeam: { id: 3, name: "Cowboys", city: "Dallas", logo: "/cowboys.png" },
    awayTeam: { id: 4, name: "Commanders", city: "Washington", logo: "/commanders.png" },
    date: "2025-09-01",
    time: "4:00 PM",
    location: "AT&T Stadium",
    status: "Final",
    homeScore: 30,
    awayScore: 20,
    players: [
      { id: 103, name: "Dak Prescott", team: "Cowboys", position: "QB", stats: { passing: "280 yds", touchdowns: 3 } },
      { id: 104, name: "Terry McLaurin", team: "Commanders", position: "WR", stats: { receiving: "100 yds", touchdowns: 1 } },
    ],
  },
  {
    id: 3,
    homeTeam: { id: 5, name: "49ers", city: "San Francisco", logo: "/49ers.png" },
    awayTeam: { id: 6, name: "Seahawks", city: "Seattle", logo: "/seahawks.png" },
    date: "2025-09-01",
    time: "7:00 PM",
    location: "Levi's Stadium",
    status: "Scheduled",
    players: [
      { id: 105, name: "Brock Purdy", team: "49ers", position: "QB", stats: { passing: "270 yds", touchdowns: 2 } },
      { id: 106, name: "Geno Smith", team: "Seahawks", position: "QB", stats: { passing: "240 yds", touchdowns: 1 } },
    ],
  },
];

export function GameCard({ game }: GameCardProps) {
  const isLive = game.status === "Live";
  const isFinal = game.status === "Final";

  return (
    <Card className="w-[350px] mb-4">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="h-8 w-8" />
            <span>{game.awayTeam.name}</span>
          </div>
          <span className="text-lg font-bold">
            {isFinal ? `${game.awayScore} - ${game.homeScore}` : `${game.time}`}
          </span>
          <div className="flex items-center gap-2">
            <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="h-8 w-8" />
            <span>{game.homeTeam.name}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{game.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{game.location}</span>
          </div>
        </div>
        {isLive && (
          <div className="flex flex-col gap-2 mb-2">
            {game.players?.slice(0, 2).map((player) => (
              <div key={player.id} className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{player.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {player.position}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {Object.entries(player.stats).map(([key, value]) => (
                    <span key={key} className="text-sm text-muted-foreground">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLive && !isFinal && (
          <Button variant="outline" className="w-full">
            View Details
          </Button>
        )}
        {isFinal && (
          <div className="flex justify-center">
            <Button variant="ghost" className="text-blue-500 hover:text-blue-700">
              View Game Recap
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MLBAlerts() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">MLB Game Alerts</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}