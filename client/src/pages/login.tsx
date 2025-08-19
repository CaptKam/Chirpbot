import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, User, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      return apiRequest("POST", "/api/auth/login", { username, password });
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in to ChirpBot.",
      });
      // Redirect to dashboard
      window.location.href = "/dashboard";
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter your username.",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter your password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Welcome Back</h1>
          <p className="text-slate-300">Sign in to your ChirpBot account</p>
        </div>

        {/* Login Form */}
        <Card className="bg-[#1C2B5E] ring-1 ring-slate-700 border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-slate-100">Sign In</CardTitle>
            <CardDescription className="text-center text-slate-300">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-slate-200">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    data-testid="input-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="pl-10 h-12 bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 h-12 bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                data-testid="button-login"
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold shadow-lg shadow-emerald-500/25"
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-300">
                Don't have an account?{" "}
                <Link href="/signup">
                  <span className="text-emerald-400 hover:text-emerald-300 hover:underline font-medium cursor-pointer">
                    Sign up here
                  </span>
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link href="/">
                <Button variant="ghost" data-testid="link-home" className="text-slate-400 hover:text-slate-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 text-center text-slate-400 text-sm">
          <p className="mb-2">⚡ Get back to real-time alerts</p>
          <p className="mb-2">🎯 Your personalized sports feed</p>
          <p>📱 Seamless cross-device experience</p>
        </div>
      </div>
    </div>
  );
}