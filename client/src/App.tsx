import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/not-found";
import Calendar from "./pages/calendar";
import Alerts from "./pages/alerts";
import Settings from "./pages/settings";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

function AppContent() {
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'new_alert':
          toast({
            title: "New Alert",
            description: (lastMessage.data as any).title,
          });
          break;
        case 'team_monitoring_changed':
          // Handle team monitoring changes if needed
          break;
        case 'settings_changed':
          // Handle settings changes if needed
          break;
      }
    }
  }, [lastMessage, toast]);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative">
      <Switch>
        <Route path="/" component={Calendar} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      <BottomNavigation />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-chirp-gray min-h-screen">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
