import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, User, Lock, Mail, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const signupMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      return apiRequest("POST", "/api/auth/signup", { username, password });
    },
    onSuccess: () => {
      toast({
        title: "Account created!",
        description: "Your ChirpBot account has been created successfully. You can now sign in.",
      });
      // Redirect to dashboard after signup
      window.location.href = "/dashboard";
    },
    onError: (error: Error) => {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account. Please try again.",
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
        description: "Please enter a username.",
        variant: "destructive",
      });
      return;
    }

    if (username.length < 3) {
      toast({
        title: "Username too short",
        description: "Username must be at least 3 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter a password.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    signupMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Join ChirpBot</h1>
          <p className="text-slate-300">Get real-time sports alerts powered by AI</p>
        </div>

        {/* Signup Form */}
        <Card className="bg-[#1C2B5E] ring-1 ring-slate-700 border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-slate-100">Create Account</CardTitle>
            <CardDescription className="text-center text-slate-300">
              Enter your details to get started with ChirpBot
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
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    data-testid="input-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10 h-12 bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                data-testid="button-signup"
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold shadow-lg shadow-emerald-500/25"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-300">
                Already have an account?{" "}
                <Link href="/login">
                  <span className="text-emerald-400 hover:text-emerald-300 hover:underline font-medium cursor-pointer">
                    Sign in here
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
          <p className="mb-2">✨ AI-powered sports analysis</p>
          <p className="mb-2">⚡ Real-time game alerts</p>
          <p>🏆 MLB • NFL • NBA • NHL coverage</p>
        </div>
      </div>
    </div>
  );
}