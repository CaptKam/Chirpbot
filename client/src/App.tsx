import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import Calendar from "./pages/calendar";
import Settings from "./pages/settings";
import Signup from "./pages/signup";
import Login from "./pages/login";
import Alerts from "./pages/alerts";
import { BottomNavigation } from "@/components/bottom-navigation";
import { AuthLoading } from "@/components/sports-loading";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isAdminSession, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  // Redirect admin users to admin panel (server-side route)
  if (isAdmin || isAdminSession) {
    window.location.replace('/admin-panel');
    return <AuthLoading />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isAdminSession, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  // Redirect admins to admin panel first (server-side route)
  if (isAdminSession || isAdmin) {
    window.location.replace('/admin-panel');
    return <AuthLoading />;
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function RegularAppContent() {
  const { isAuthenticated } = useAuth();

  // Get settings to check if push notifications are enabled
  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    enabled: isAuthenticated,
  });


  return (
    <div className={isAuthenticated ? "max-w-md mx-auto bg-transparent min-h-screen relative" : "min-h-screen"}>
      <Switch>
        <Route path="/"><PublicRoute><Landing /></PublicRoute></Route>
        <Route path="/login"><PublicRoute><Login /></PublicRoute></Route>
        <Route path="/signup"><PublicRoute><Signup /></PublicRoute></Route>
        <Route path="/dashboard"><ProtectedRoute><Calendar /></ProtectedRoute></Route>
        <Route path="/calendar"><ProtectedRoute><Calendar /></ProtectedRoute></Route>
        <Route path="/alerts"><ProtectedRoute><Alerts /></ProtectedRoute></Route>
        <Route path="/settings"><ProtectedRoute><Settings /></ProtectedRoute></Route>
        <Route component={NotFound} />
      </Switch>
      {isAuthenticated && <BottomNavigation />}
    </div>
  );
}

function AppContent() {
  return <RegularAppContent />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-gradient-to-b from-[#0B1220] to-[#0F1A32] min-h-screen text-slate-100 antialiased">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;