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
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const signupMutation = useMutation({
    mutationFn: async ({ usernameOrEmail, password, firstName, lastName }: { usernameOrEmail: string; password: string; firstName?: string; lastName?: string }) => {
      return apiRequest("POST", "/api/auth/signup", { usernameOrEmail, password, firstName, lastName });
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
    
    if (!usernameOrEmail.trim()) {
      toast({
        title: "Username or email required",
        description: "Please enter a username or email.",
        variant: "destructive",
      });
      return;
    }

    if (usernameOrEmail.length < 3) {
      toast({
        title: "Username or email too short",
        description: "Username or email must be at least 3 characters long.",
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
    signupMutation.mutate({ usernameOrEmail, password, firstName: firstName || undefined, lastName: lastName || undefined });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Join ChirpBot</h1>
          <p className="text-slate-300">Get real-time sports alerts powered by AI</p>
        </div>

        {/* Signup Form */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-slate-100">Create Account</CardTitle>
            <CardDescription className="text-center text-slate-300">
              Enter your details to get started with ChirpBot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-200">
                    First Name (Optional)
                  </Label>
                  <Input
                    id="firstName"
                    data-testid="input-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="h-12 bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
                    disabled={isLoading}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-200">
                    Last Name (Optional)
                  </Label>
                  <Input
                    id="lastName"
                    data-testid="input-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="h-12 bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
                    disabled={isLoading}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="usernameOrEmail" className="text-sm font-medium text-slate-200">
                  Username or Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="usernameOrEmail"
                    data-testid="input-username-email"
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Enter username or email"
                    className="pl-10 h-12 bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
                    disabled={isLoading}
                    autoComplete="username email"
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
                    className="pl-10 h-12 bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
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
                    className="pl-10 h-12 bg-white/10 border-white/20 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:ring-emerald-500/50"
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

            {/* Social Auth Divider */}
            <div className="my-6 flex items-center">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="px-4 text-slate-400 text-sm">or continue with</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            {/* Social Auth Buttons */}
            <div className="space-y-3">
              <Button 
                variant="outline"
                className="w-full h-12 bg-white/5 border-white/20 text-slate-200 hover:bg-white/10 hover:border-white/30"
                onClick={() => window.location.href = '/api/auth/google'}
                data-testid="button-google-signup"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
              
              <Button 
                variant="outline"
                className="w-full h-12 bg-white/5 border-white/20 text-slate-200 hover:bg-white/10 hover:border-white/30"
                onClick={() => window.location.href = '/api/auth/apple'}
                data-testid="button-apple-signup"
              >
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Continue with Apple
              </Button>
            </div>

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