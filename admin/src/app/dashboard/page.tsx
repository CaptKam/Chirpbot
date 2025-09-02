'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Activity, Bell, TrendingUp, Users, ArrowRight } from 'lucide-react'

interface DashboardStats {
  openAlerts: number
  mutedToday: number
  resentToday: number
  componentsUp: number
  componentsTotal: number
}

interface HealthStatus {
  component: string
  status: 'UP' | 'DOWN' | 'DEGRADED'
  detail?: any
  lastUpdated: string
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    openAlerts: 0,
    mutedToday: 0,
    resentToday: 0,
    componentsUp: 0,
    componentsTotal: 6
  })
  const [healthStatus, setHealthStatus] = useState<HealthStatus[]>([])
  const [recentAlerts, setRecentAlerts] = useState<any[]>([])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardData()
      const interval = setInterval(fetchDashboardData, 10000)
      return () => clearInterval(interval)
    }
  }, [status])

  const fetchDashboardData = async () => {
    try {
      // Fetch real data from API
      const [statsResponse, healthResponse, alertsResponse] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/health'),
        fetch('/api/admin/alerts?limit=5')
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setHealthStatus(healthData.slice(0, 6)) // Show top 6 components
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setRecentAlerts(alertsData.slice(0, 5)) // Show last 5 alerts
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      // Fallback to mock data for development
      setStats({
        openAlerts: 12,
        mutedToday: 3,
        resentToday: 1,
        componentsUp: 5,
        componentsTotal: 6
      })
      
      setHealthStatus([
        { component: 'MLB API', status: 'UP', lastUpdated: '2 min ago' },
        { component: 'ESPN API', status: 'UP', lastUpdated: '1 min ago' },
        { component: 'Weather Service', status: 'DEGRADED', lastUpdated: '5 min ago', detail: 'Rate limited' },
        { component: 'Telegram Bot', status: 'UP', lastUpdated: '30s ago' },
        { component: 'Alert Engine', status: 'UP', lastUpdated: '10s ago' },
        { component: 'Database', status: 'UP', lastUpdated: '5s ago' },
      ])
      
      setRecentAlerts([
        {
          id: '1',
          sport: 'MLB',
          type: 'RISP',
          game: 'Giants @ Rockies',
          message: '2nd & 3rd base, 2 outs',
          time: '2 min ago',
          status: 'OPEN'
        },
        {
          id: '2',
          sport: 'MLB', 
          type: 'HOME_RUN',
          game: 'Phillies @ Brewers',
          message: 'Solo home run by Bryce Harper',
          time: '5 min ago',
          status: 'ACKED'
        }
      ])
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p>Access denied. Please sign in.</p>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UP': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'DOWN': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'DEGRADED': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">ChirpBot Back Office</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user?.email} ({session.user?.role || 'VIEWER'})
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Alerts</p>
                <p className="text-2xl font-bold">{stats.openAlerts}</p>
              </div>
              <Bell className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Muted Today</p>
                <p className="text-2xl font-bold">{stats.mutedToday}</p>
              </div>
              <Users className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resent Today</p>
                <p className="text-2xl font-bold">{stats.resentToday}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Health</p>
                <p className="text-2xl font-bold">
                  {stats.componentsUp}/{stats.componentsTotal}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Recent Alerts</CardTitle>
            <Link href="/dashboard/alerts">
              <Button variant="ghost" size="sm" className="text-primary">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-semibold text-primary px-2 py-1 bg-primary/20 rounded">
                        {alert.sport}
                      </span>
                      <span className="text-xs text-muted-foreground">{alert.type}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{alert.game || alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.message && alert.game ? alert.message : 'Live alert'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`text-xs px-2 py-1 rounded border ${getStatusBadge(alert.status)}`}>
                      {alert.status}
                    </div>
                  </div>
                </div>
              ))}
              {recentAlerts.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recent alerts</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">System Health</CardTitle>
            <Link href="/dashboard/health">
              <Button variant="ghost" size="sm" className="text-primary">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {healthStatus.map((component) => (
                <div key={component.component} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{component.component}</p>
                    {component.detail?.message && (
                      <p className="text-xs text-muted-foreground truncate">
                        {component.detail.message}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className={`text-xs px-2 py-1 rounded border ${getStatusBadge(component.status)}`}>
                      {component.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}