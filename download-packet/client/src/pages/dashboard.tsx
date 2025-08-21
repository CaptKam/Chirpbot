import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { apiRequest } from "../lib/queryClient";

interface User {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => apiRequest<{ user: User }>("/api/auth/user").then(res => res.user),
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2387F4]"></div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F2F4F7]">
      {/* Header */}
      <header className="border-b border-[#DCE1E7] bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#1C2B5E] uppercase tracking-wide">
            SPORTS APP
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              Welcome, {user.firstName || user.username || "User"}!
            </span>
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          {/* Welcome Card */}
          <Card className="sports-card">
            <CardHeader>
              <CardTitle className="text-[#1C2B5E]">WELCOME</CardTitle>
              <CardDescription>
                Your sports app framework is ready to be customized
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#6B7280]">
                This is a clean sports application framework with modern design, 
                authentication, and a professional UI system ready for your features.
              </p>
            </CardContent>
          </Card>

          {/* Features Card */}
          <Card className="sports-card">
            <CardHeader>
              <CardTitle className="text-[#1C2B5E]">FEATURES</CardTitle>
              <CardDescription>
                Built-in functionality for rapid development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li>✅ User Authentication</li>
                <li>✅ Modern Design System</li>
                <li>✅ Responsive Layout</li>
                <li>✅ Database Ready</li>
                <li>✅ API Framework</li>
              </ul>
            </CardContent>
          </Card>

          {/* Profile Card */}
          <Card className="sports-card">
            <CardHeader>
              <CardTitle className="text-[#1C2B5E]">PROFILE</CardTitle>
              <CardDescription>
                Your account information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Username:</span> {user.username || "Not set"}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {user.email || "Not set"}
                </div>
                <div>
                  <span className="font-medium">Role:</span> {user.role}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="sports-card">
            <CardHeader>
              <CardTitle className="text-[#1C2B5E]">QUICK ACTIONS</CardTitle>
              <CardDescription>
                Common development tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-16 flex-col">
                  <span className="font-semibold">Add Features</span>
                  <span className="text-xs text-[#6B7280]">Extend the app</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <span className="font-semibold">Customize Design</span>
                  <span className="text-xs text-[#6B7280]">Modify colors & style</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <span className="font-semibold">Add Pages</span>
                  <span className="text-xs text-[#6B7280]">Create new routes</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <span className="font-semibold">Deploy App</span>
                  <span className="text-xs text-[#6B7280]">Go live</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}