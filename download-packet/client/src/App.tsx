import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router, Switch } from "wouter";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Switch>
          <Route path="/" component={LoginPage} />
          <Route path="/dashboard" component={DashboardPage} />
        </Switch>
      </Router>
    </QueryClientProvider>
  );
}

export default App;