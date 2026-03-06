import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";
import Calendar from "./pages/calendar";
import Settings from "./pages/settings";
import Signup from "./pages/signup";
import Login from "./pages/login";
import Alerts from "./pages/alerts";
import GameNarrative from "./pages/game-narrative";
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

// Stable page wrapper components — defined outside render to prevent remounts
function PublicLanding() { return <PublicRoute><Landing /></PublicRoute>; }
function PublicLogin() { return <PublicRoute><Login /></PublicRoute>; }
function PublicSignup() { return <PublicRoute><Signup /></PublicRoute>; }
function ProtectedDashboard() { return <ProtectedRoute><Dashboard /></ProtectedRoute>; }
function ProtectedCalendar() { return <ProtectedRoute><Calendar /></ProtectedRoute>; }
function ProtectedAlerts() { return <ProtectedRoute><Alerts /></ProtectedRoute>; }
function ProtectedSettings() { return <ProtectedRoute><Settings /></ProtectedRoute>; }
function ProtectedGameNarrative() { return <ProtectedRoute><GameNarrative /></ProtectedRoute>; }

function RegularAppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className={isAuthenticated ? "max-w-md mx-auto bg-transparent min-h-screen relative safe-area-bottom" : "min-h-screen"}>
      <Switch>
        <Route path="/" component={PublicLanding} />
        <Route path="/login" component={PublicLogin} />
        <Route path="/signup" component={PublicSignup} />
        <Route path="/dashboard" component={ProtectedDashboard} />
        <Route path="/calendar" component={ProtectedCalendar} />
        <Route path="/alerts" component={ProtectedAlerts} />
        <Route path="/settings" component={ProtectedSettings} />
        <Route path="/game/:gameId" component={ProtectedGameNarrative} />
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
        <div className="min-h-screen text-white antialiased bg-[#101922]">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;