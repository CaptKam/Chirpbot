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

// Stable page wrapper components — defined outside render to prevent remounts
function PublicLanding() { return <PublicRoute><Landing /></PublicRoute>; }
function PublicLogin() { return <PublicRoute><Login /></PublicRoute>; }
function PublicSignup() { return <PublicRoute><Signup /></PublicRoute>; }
function ProtectedCalendar() { return <ProtectedRoute><Calendar /></ProtectedRoute>; }
function ProtectedAlerts() { return <ProtectedRoute><Alerts /></ProtectedRoute>; }
function ProtectedSettings() { return <ProtectedRoute><Settings /></ProtectedRoute>; }

function RegularAppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className={isAuthenticated ? "max-w-md mx-auto bg-transparent min-h-screen relative safe-area-bottom" : "min-h-screen"}>
      <Switch>
        <Route path="/" component={PublicLanding} />
        <Route path="/login" component={PublicLogin} />
        <Route path="/signup" component={PublicSignup} />
        <Route path="/dashboard" component={ProtectedCalendar} />
        <Route path="/calendar" component={ProtectedCalendar} />
        <Route path="/alerts" component={ProtectedAlerts} />
        <Route path="/settings" component={ProtectedSettings} />
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
        <div className="bg-gradient-to-b from-[#0D1117] to-[#0D0D0D] min-h-screen text-slate-100 antialiased">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;