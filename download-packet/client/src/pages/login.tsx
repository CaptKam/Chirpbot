import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { apiRequest } from "../lib/queryClient";

interface LoginForm {
  usernameOrEmail: string;
  password: string;
}

interface User {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState<LoginForm>({
    usernameOrEmail: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => 
      apiRequest<{ user: User; message: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data.user);
      window.location.href = "/dashboard";
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: typeof registerForm) => 
      apiRequest<{ user: User; message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data.user);
      window.location.href = "/dashboard";
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(form);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerForm);
  };

  return (
    <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-[#1C2B5E]">
            SPORTS APP
          </CardTitle>
          <CardDescription>
            {isRegister ? "Create your account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {!isRegister ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Username or Email"
                  value={form.usernameOrEmail}
                  onChange={(e) => setForm({ ...form, usernameOrEmail: e.target.value })}
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              
              {loginMutation.error && (
                <div className="text-[#F02D3A] text-sm">
                  {loginMutation.error.message}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="First Name"
                  value={registerForm.firstName}
                  onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                />
                <Input
                  type="text"
                  placeholder="Last Name"
                  value={registerForm.lastName}
                  onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                />
              </div>
              <div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  required
                />
              </div>
              
              {registerMutation.error && (
                <div className="text-[#F02D3A] text-sm">
                  {registerMutation.error.message}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          )}
          
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-[#2387F4] text-sm hover:underline"
            >
              {isRegister 
                ? "Already have an account? Sign in" 
                : "Need an account? Sign up"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}