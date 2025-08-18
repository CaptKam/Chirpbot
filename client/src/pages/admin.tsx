import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  BookOpen, 
  Shield, 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Settings,
  BarChart3
} from "lucide-react";
import type { User, SportLearning, UserPermission, AdminLog } from "@shared/schema";
import { Link } from "wouter";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];
const LEARNING_CATEGORIES = ["alerts", "strategies", "rules", "analysis"];
const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"];
const USER_ROLES = ["user", "moderator", "admin"];
const PERMISSIONS = [
  "manage_users",
  "manage_content", 
  "view_analytics",
  "manage_alerts",
  "manage_permissions"
];

export default function AdminPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Check if user is admin
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You need admin privileges to access this portal.
            </p>
            <Link href="/">
              <Button variant="outline">Return to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F7]" data-testid="admin-portal">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1C2B5E] tracking-wider">
                CHIRPBOT ADMIN PORTAL
              </h1>
              <p className="text-gray-600 mt-2">
                Manage users, content, and system settings
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" data-testid="button-back-home">
                Back to App
              </Button>
            </Link>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Learning
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          {/* Users Management Tab */}
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          {/* Learning Content Management Tab */}
          <TabsContent value="learning">
            <LearningTab />
          </TabsContent>

          {/* Permissions Management Tab */}
          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab() {
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="admin-overview">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="h-8 w-8 text-[#2387F4]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Sessions</p>
              <p className="text-2xl font-bold">{stats?.activeSessions || 0}</p>
            </div>
            <Activity className="h-8 w-8 text-[#2387F4]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Learning Articles</p>
              <p className="text-2xl font-bold">{stats?.totalArticles || 0}</p>
            </div>
            <BookOpen className="h-8 w-8 text-[#2387F4]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alerts Today</p>
              <p className="text-2xl font-bold">{stats?.alertsToday || 0}</p>
            </div>
            <Settings className="h-8 w-8 text-[#2387F4]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Users Management Tab Component
function UsersTab() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 5000,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: { userId: string; role: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${userData.userId}`, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6" data-testid="users-management">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user roles, permissions, and account status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`user-row-${user.id}`}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(user.createdAt!).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <Badge variant={user.isActive ? "default" : "destructive"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                    data-testid={`button-edit-user-${user.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Learning Content Management Tab Component
function LearningTab() {
  const [selectedSport, setSelectedSport] = useState("MLB");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const { data: articles = [] } = useQuery<SportLearning[]>({
    queryKey: ["/api/admin/learning", { sport: selectedSport }],
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6" data-testid="learning-management">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Learning Content Management</h2>
          <p className="text-gray-600">Create and manage educational content per sport</p>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          data-testid="button-create-article"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Article
        </Button>
      </div>

      {/* Sport Selector */}
      <div className="flex gap-4">
        {SPORTS.map((sport) => (
          <Button
            key={sport}
            variant={selectedSport === sport ? "default" : "outline"}
            onClick={() => setSelectedSport(sport)}
            data-testid={`button-sport-${sport.toLowerCase()}`}
          >
            {sport}
          </Button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <Card key={article.id} data-testid={`article-card-${article.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{article.category}</Badge>
                <Badge variant={article.isPublished ? "default" : "secondary"}>
                  {article.isPublished ? "Published" : "Draft"}
                </Badge>
              </div>
              <CardTitle className="text-lg">{article.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {article.content.substring(0, 100)}...
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{article.difficulty}</Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">No learning content for {selectedSport} yet.</p>
          <Button 
            className="mt-4" 
            onClick={() => setIsCreating(true)}
          >
            Create First Article
          </Button>
        </div>
      )}
    </div>
  );
}

// Permissions Management Tab Component  
function PermissionsTab() {
  const { data: permissions = [] } = useQuery<UserPermission[]>({
    queryKey: ["/api/admin/permissions"],
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6" data-testid="permissions-management">
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Manage fine-grained permissions for users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`permission-row-${permission.id}`}
              >
                <div>
                  <p className="font-medium">{permission.permission}</p>
                  <p className="text-sm text-gray-600">
                    Resource: {permission.resource || "Global"}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Activity Logs Tab Component
function LogsTab() {
  const { data: logs = [] } = useQuery<AdminLog[]>({
    queryKey: ["/api/admin/logs"],
    refetchInterval: 3000,
  });

  return (
    <div className="space-y-6" data-testid="activity-logs">
      <Card>
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
          <CardDescription>
            Track admin actions and system changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`log-entry-${log.id}`}
              >
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-gray-600">
                    Resource: {log.resource} | {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">
                  {log.adminId}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}