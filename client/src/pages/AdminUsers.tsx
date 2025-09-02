import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Shield, User, Settings, ChevronRight, Lock, Check, X, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AlertType {
  id: string;
  key: string;
  sport: string;
  category: string;
  label: string;
  description: string;
  enabledDefault: boolean;
  priority: number;
}

interface UserPermission {
  id: string;
  userId: string;
  alertTypeId: string;
  allowed: boolean;
  alertType?: AlertType;
}

const ROLES = [
  { value: "admin", label: "Admin", description: "Full system access" },
  { value: "operator", label: "Operator", description: "Manage users and alerts" },
  { value: "viewer", label: "Viewer", description: "View-only access" },
  { value: "user", label: "User", description: "Standard user access" }
];

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF"];

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState("MLB");

  // Check if current user is admin
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
    }
  }, [currentUser, navigate, toast]);

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: currentUser?.role === "admin",
  });

  // Fetch alert types
  const { data: alertTypes, isLoading: alertTypesLoading } = useQuery({
    queryKey: [`/api/admin/alert-types?sport=${selectedSport}`],
    enabled: currentUser?.role === "admin" && isDialogOpen,
  });

  // Fetch user permissions when a user is selected
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: [`/api/admin/users/${selectedUser?.id}/permissions`],
    enabled: !!selectedUser && isDialogOpen,
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    },
  });

  // Update user permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Array<{ alertTypeId: string; allowed: boolean }> }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/permissions`, permissions);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${selectedUser?.id}/permissions`] });
      toast({
        title: "Permissions Updated",
        description: "User permissions have been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user permissions.",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: string, role: string) => {
    updateRoleMutation.mutate({ userId, role });
  };

  const handlePermissionToggle = (alertTypeId: string, allowed: boolean) => {
    if (!selectedUser) return;
    
    const currentPermissions = userPermissions || [];
    const existingPermission = currentPermissions.find((p: UserPermission) => p.alertTypeId === alertTypeId);
    
    const updatedPermissions = [{
      alertTypeId,
      allowed
    }];
    
    updatePermissionsMutation.mutate({ userId: selectedUser.id, permissions: updatedPermissions });
  };

  const getPermissionStatus = (alertTypeId: string) => {
    if (!userPermissions) return null;
    const permission = userPermissions.find((p: UserPermission) => p.alertTypeId === alertTypeId);
    return permission ? permission.allowed : null;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "text-red-500";
      case "operator": return "text-orange-500";
      case "viewer": return "text-blue-500";
      default: return "text-gray-500";
    }
  };

  if (!currentUser || currentUser.role !== "admin") {
    return null;
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-500/20 ring-1 ring-red-500/30 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Admin Panel</h1>
              <p className="text-red-300/80 text-xs font-medium">User Management</p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-slate-100 hover:bg-white/10"
          >
            Back to App
          </Button>
        </div>
      </header>

      {/* Users List */}
      <div className="p-4 space-y-4">
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-100 mb-4">System Users</h2>
          
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {users?.map((user: User) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-slate-100">{user.username}</p>
                        <span className={`text-xs font-bold uppercase ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                      disabled={user.id === currentUser.id || updateRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-32 bg-white/5 border-white/20 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsDialogOpen(true);
                      }}
                      className="text-slate-300 hover:text-slate-100 hover:bg-white/10"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Permissions
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl bg-[#0B1220] border-white/10 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>User Permissions</span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedUser ? `Managing permissions for ${selectedUser.username}` : ""}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="mt-6">
              <Tabs value={selectedSport} onValueChange={setSelectedSport}>
                <TabsList className="bg-white/5 border border-white/10">
                  {SPORTS.map((sport) => (
                    <TabsTrigger
                      key={sport}
                      value={sport}
                      className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
                    >
                      {sport}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <TabsContent value={selectedSport} className="mt-4">
                  <ScrollArea className="h-[500px] pr-4">
                    {alertTypesLoading || permissionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(
                          alertTypes?.reduce((acc: any, alertType: AlertType) => {
                            if (!acc[alertType.category]) acc[alertType.category] = [];
                            acc[alertType.category].push(alertType);
                            return acc;
                          }, {}) || {}
                        ).map(([category, types]) => (
                          <div key={category} className="space-y-3">
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                              {category}
                            </h3>
                            <div className="space-y-2">
                              {(types as AlertType[]).map((alertType) => {
                                const permissionStatus = getPermissionStatus(alertType.id);
                                const isAllowed = permissionStatus !== null ? permissionStatus : alertType.enabledDefault;
                                
                                return (
                                  <div
                                    key={alertType.id}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-semibold text-slate-100">
                                          {alertType.label}
                                        </h4>
                                        {permissionStatus === null && (
                                          <span className="text-xs text-slate-500">(default)</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-1">
                                        {alertType.description}
                                      </p>
                                    </div>
                                    <Switch
                                      checked={isAllowed}
                                      onCheckedChange={(checked) => handlePermissionToggle(alertType.id, checked)}
                                      disabled={updatePermissionsMutation.isPending}
                                      className="data-[state=checked]:bg-emerald-500"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}