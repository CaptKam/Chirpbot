import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Activity, Trophy, Clock, MapPin, Users, ChevronRight, RefreshCw, Circle } from "lucide-react";

interface GameState {
  id: string;
  sport: string;
  extGameId: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  clock: string | null;
  startUtc: string | null;
  payload: any;
  updatedAt: string;
}

const SPORTS = ["ALL", "MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"];

export default function AdminLive() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedSport, setSelectedSport] = useState("ALL");
  const [selectedGame, setSelectedGame] = useState<GameState | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Check if current user is admin or operator
  useEffect(() => {
    if (currentUser && !["admin", "operator"].includes(currentUser.role)) {
      navigate("/");
      toast({
        title: "Access Denied",
        description: "You need admin or operator privileges to access this page.",
        variant: "destructive",
      });
    }
  }, [currentUser, navigate, toast]);

  // Fetch game states
  const { data: gameStates, isLoading, refetch } = useQuery({
    queryKey: [`/api/admin/game-states${selectedSport !== "ALL" ? `?sport=${selectedSport}` : ""}`],
    enabled: !!currentUser && ["admin", "operator"].includes(currentUser.role),
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10 seconds if enabled
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!currentUser || !["admin", "operator"].includes(currentUser.role)) return;

    const ws = new WebSocket(`ws://localhost:5000/admin`);
    
    ws.onopen = () => {
      console.log("Admin WebSocket connected");
      // Join sports rooms
      ws.send(JSON.stringify({ 
        type: "join", 
        sports: selectedSport === "ALL" ? ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"] : [selectedSport] 
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "game.update") {
        // Trigger refetch when game updates come in
        refetch();
      }
    };

    ws.onerror = (error) => {
      console.error("Admin WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Admin WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, [currentUser, selectedSport, refetch]);

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "LIVE": return "bg-green-500";
      case "FINAL": return "bg-gray-500";
      case "SCHEDULED": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case "LIVE": return "LIVE";
      case "FINAL": return "FINAL";
      case "SCHEDULED": return "SCHEDULED";
      default: return status;
    }
  };

  const formatClock = (sport: string, clock: string | null) => {
    if (!clock) return "-";
    
    if (sport === "MLB") {
      return clock; // e.g., "Top 7th, 2 outs"
    } else if (["NFL", "NCAAF", "CFL"].includes(sport)) {
      return clock; // e.g., "Q3 5:23"
    } else if (["NBA", "NHL"].includes(sport)) {
      return clock; // e.g., "3rd 8:45"
    }
    
    return clock;
  };

  const formatStartTime = (startUtc: string | null) => {
    if (!startUtc) return "-";
    const date = new Date(startUtc);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const filteredGames = gameStates?.filter((game: GameState) => 
    selectedSport === "ALL" || game.sport === selectedSport
  ) || [];

  const liveGames = filteredGames.filter((g: GameState) => g.status === "LIVE");
  const scheduledGames = filteredGames.filter((g: GameState) => g.status === "SCHEDULED");
  const finalGames = filteredGames.filter((g: GameState) => g.status === "FINAL");

  if (!currentUser || !["admin", "operator"].includes(currentUser.role)) {
    return null;
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-500/20 ring-1 ring-purple-500/30 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Live Sports Monitor</h1>
              <p className="text-purple-300/80 text-xs font-medium">Real-time Game States</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              className={autoRefresh ? "bg-emerald-500 hover:bg-emerald-600" : ""}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <Button
              onClick={() => navigate("/admin/users")}
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-slate-100 hover:bg-white/10"
            >
              User Management
            </Button>
            <Button
              onClick={() => navigate("/")}
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-slate-100 hover:bg-white/10"
            >
              Back to App
            </Button>
          </div>
        </div>
      </header>

      {/* Sport Tabs */}
      <div className="p-4">
        <Tabs value={selectedSport} onValueChange={setSelectedSport}>
          <TabsList className="bg-white/5 border border-white/10">
            {SPORTS.map((sport) => (
              <TabsTrigger
                key={sport}
                value={sport}
                className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
              >
                {sport}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedSport} className="mt-4 space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-green-500/10 backdrop-blur-sm ring-1 ring-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-400 uppercase tracking-wide font-bold">Live Games</p>
                    <p className="text-2xl font-black text-white">{liveGames.length}</p>
                  </div>
                  <Circle className="w-8 h-8 text-green-400 fill-green-400 animate-pulse" />
                </div>
              </Card>
              
              <Card className="bg-blue-500/10 backdrop-blur-sm ring-1 ring-blue-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-400 uppercase tracking-wide font-bold">Scheduled</p>
                    <p className="text-2xl font-black text-white">{scheduledGames.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-400" />
                </div>
              </Card>
              
              <Card className="bg-gray-500/10 backdrop-blur-sm ring-1 ring-gray-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">Final</p>
                    <p className="text-2xl font-black text-white">{finalGames.length}</p>
                  </div>
                  <Trophy className="w-8 h-8 text-gray-400" />
                </div>
              </Card>
            </div>

            {/* Games List */}
            <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">
                Game States
              </h2>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400">No games found for {selectedSport}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGames.map((game: GameState) => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedGame(game);
                        setIsDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center space-x-4">
                        <span className={`${getStatusColor(game.status)} text-white px-2 py-1 rounded text-xs font-bold uppercase`}>
                          {getStatusText(game.status)}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-100">{game.sport}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-sm text-slate-300">
                              {game.awayTeam} @ {game.homeTeam}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-lg font-black text-white">
                              {game.awayScore} - {game.homeScore}
                            </span>
                            <span className="text-sm text-slate-400">
                              {formatClock(game.sport, game.clock)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Start Time</p>
                          <p className="text-sm text-slate-200">{formatStartTime(game.startUtc)}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Game Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl bg-[#0B1220] border-white/10 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>Game Details</span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedGame ? `${selectedGame.awayTeam} @ ${selectedGame.homeTeam}` : ""}
            </DialogDescription>
          </DialogHeader>
          
          {selectedGame && (
            <div className="mt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase">Status</p>
                    <span className={`${getStatusColor(selectedGame.status)} text-white px-2 py-1 rounded text-xs font-bold uppercase inline-block mt-1`}>
                      {getStatusText(selectedGame.status)}
                    </span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase">Sport</p>
                    <p className="font-bold text-white">{selectedGame.sport}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase">Score</p>
                    <p className="text-lg font-black text-white">
                      {selectedGame.awayScore} - {selectedGame.homeScore}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase">Clock</p>
                    <p className="font-bold text-white">
                      {formatClock(selectedGame.sport, selectedGame.clock)}
                    </p>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300 mb-3">
                    Raw Payload
                  </h3>
                  <ScrollArea className="h-[400px]">
                    <pre className="text-xs text-slate-400 font-mono">
                      {JSON.stringify(selectedGame.payload, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}