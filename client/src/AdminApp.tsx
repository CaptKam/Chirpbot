import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";

function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen text-slate-100 antialiased">
          <Toaster />
          <Switch>
            <Route path="/admin" component={AdminDashboard} />
            <Route path="/admin/login" component={AdminLogin} />
            <Route path="/admin-login" component={AdminLogin} />
            <Route component={AdminLogin} />
          </Switch>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default AdminApp;