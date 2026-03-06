import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, User, Lock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Inline validation state (Nielsen Heuristic 5: Error Prevention)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldValid, setFieldValid] = useState<Record<string, boolean>>({});

  const validateField = useCallback((name: string, value: string) => {
    if (name === 'usernameOrEmail') {
      if (!value.trim()) {
        setFieldErrors(prev => ({ ...prev, usernameOrEmail: 'Please enter your username or email' }));
        setFieldValid(prev => ({ ...prev, usernameOrEmail: false }));
      } else {
        setFieldErrors(prev => { const copy = { ...prev }; delete copy.usernameOrEmail; return copy; });
        setFieldValid(prev => ({ ...prev, usernameOrEmail: true }));
      }
    }
    if (name === 'password') {
      if (!value) {
        setFieldErrors(prev => ({ ...prev, password: 'Please enter your password' }));
        setFieldValid(prev => ({ ...prev, password: false }));
      } else {
        setFieldErrors(prev => { const copy = { ...prev }; delete copy.password; return copy; });
        setFieldValid(prev => ({ ...prev, password: true }));
      }
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ usernameOrEmail, password }: { usernameOrEmail: string; password: string }) => {
      return apiRequest("POST", "/api/auth/login", { usernameOrEmail, password });
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in to ChirpBot.",
      });
      window.location.href = "/dashboard";
    },
    onError: (error: Error) => {
      // Nielsen Heuristic 9: Plain English, say what went wrong and how to fix
      toast({
        title: "Unable to sign in",
        description: error.message || "Your username or password is incorrect. Please check your credentials and try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields inline (not just toast)
    validateField('usernameOrEmail', usernameOrEmail);
    validateField('password', password);

    if (!usernameOrEmail.trim() || !password) {
      return;
    }

    setIsLoading(true);
    loginMutation.mutate({ usernameOrEmail, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1117] to-[#0D0D0D] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ lineHeight: 1.2 }}>Welcome Back</h1>
          <p className="text-slate-300" style={{ fontSize: '17px', lineHeight: 1.5 }}>Sign in to your ChirpBot account</p>
        </div>

        {/* Login Form — Card surface layer (#161B22) */}
        <Card className="bg-[#161B22]/80 backdrop-blur-sm ring-1 ring-white/[0.08] border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center text-white font-bold">Sign In</CardTitle>
            <CardDescription className="text-center text-slate-300" style={{ fontSize: '15px' }}>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Username/Email — inline validation on blur (Nielsen Heuristic 5) */}
              <div className="space-y-2">
                <Label htmlFor="usernameOrEmail" className="text-sm font-semibold text-slate-200">
                  Username or Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                  <Input
                    id="usernameOrEmail"
                    data-testid="input-username-email"
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    onBlur={() => usernameOrEmail && validateField('usernameOrEmail', usernameOrEmail)}
                    placeholder="Enter username or email"
                    className={`pl-11 min-h-[48px] bg-white/[0.06] border-white/[0.12] text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500/30 ${
                      fieldErrors.usernameOrEmail ? 'border-red-500 ring-1 ring-red-500/30' : ''
                    } ${fieldValid.usernameOrEmail ? 'border-emerald-500/40' : ''}`}
                    disabled={isLoading}
                    autoComplete="username email"
                    aria-invalid={!!fieldErrors.usernameOrEmail}
                    aria-describedby={fieldErrors.usernameOrEmail ? "usernameOrEmail-error" : undefined}
                  />
                  {fieldValid.usernameOrEmail && !fieldErrors.usernameOrEmail && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" aria-hidden="true" />
                  )}
                </div>
                {fieldErrors.usernameOrEmail && (
                  <p id="usernameOrEmail-error" className="field-error-message flex items-center gap-1.5" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {fieldErrors.usernameOrEmail}
                  </p>
                )}
              </div>

              {/* Password — inline validation on blur */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-200">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                  <Input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => password && validateField('password', password)}
                    placeholder="Enter your password"
                    className={`pl-11 min-h-[48px] bg-white/[0.06] border-white/[0.12] text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500/30 ${
                      fieldErrors.password ? 'border-red-500 ring-1 ring-red-500/30' : ''
                    } ${fieldValid.password ? 'border-emerald-500/40' : ''}`}
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  />
                  {fieldValid.password && !fieldErrors.password && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" aria-hidden="true" />
                  )}
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="field-error-message flex items-center gap-1.5" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Submit — NOT disabled on empty form (Nielsen Heuristic 9) */}
              <Button
                type="submit"
                data-testid="button-login"
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold shadow-lg shadow-emerald-500/25 text-base"
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Social Auth Divider */}
            <div className="my-6 flex items-center" role="separator">
              <div className="flex-grow border-t border-white/[0.08]"></div>
              <span className="px-4 text-slate-400" style={{ fontSize: '14px' }}>or continue with</span>
              <div className="flex-grow border-t border-white/[0.08]"></div>
            </div>

            {/* Social Auth Buttons - Temporarily Disabled */}
            <div className="space-y-3">
              <Button
                variant="outline"
                disabled
                className="w-full min-h-[48px] bg-white/[0.04] border-white/[0.12] text-slate-400 font-medium opacity-50 cursor-not-allowed"
                data-testid="button-google-login"
                aria-label="Google Login - Coming Soon"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google Login (Coming Soon)
              </Button>

              <Button
                variant="outline"
                disabled
                className="w-full min-h-[48px] bg-white/[0.04] border-white/[0.12] text-slate-400 font-medium opacity-50 cursor-not-allowed"
                data-testid="button-apple-login"
                aria-label="Apple Login - Coming Soon"
              >
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Apple Login (Coming Soon)
              </Button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-slate-300" style={{ fontSize: '15px' }}>
                Don't have an account?{" "}
                <Link href="/signup">
                  <span className="text-emerald-400 hover:text-emerald-300 hover:underline font-semibold cursor-pointer">
                    Sign up here
                  </span>
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link href="/">
                <Button variant="ghost" data-testid="link-home" className="text-slate-400 hover:text-slate-200 min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
