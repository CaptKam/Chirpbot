import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

export default function AdminPortal() {
  const { user } = useAuth();
  
  // Check if user is admin
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
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

  // Query admin stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  return (
    <div className="min-h-screen bg-[#F2F4F7]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1C2B5E] tracking-wider">
            CHIRPBOT ADMIN PORTAL
          </h1>
          <p className="text-gray-600">Manage users, content, and system settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "..." : stats?.totalUsers || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "..." : stats?.activeSessions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "..." : stats?.totalArticles || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "..." : stats?.alertsToday || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usersLoading ? (
                <p>Loading users...</p>
              ) : users?.length > 0 ? (
                <div className="grid gap-4">
                  {users.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h3 className="font-medium">{user.username}</h3>
                        <p className="text-sm text-gray-600">Role: {user.role || 'user'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No users found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}