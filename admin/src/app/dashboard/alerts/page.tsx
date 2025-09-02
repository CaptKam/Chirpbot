'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Volume2, RotateCcw, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AlertItem {
  id: string
  gameId: string
  sport: string
  type: string
  status: 'OPEN' | 'MUTED' | 'ACKED' | 'RESENT'
  payload: any
  source?: string
  priority: number
  confidence: number
  message: string
  createdAt: string
  updatedAt: string
}

export default function AlertsPage() {
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [filteredAlerts, setFilteredAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    sport: '',
    type: ''
  })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Apply filters
    let filtered = alerts
    
    if (filters.status) {
      filtered = filtered.filter(alert => alert.status === filters.status)
    }
    
    if (filters.sport) {
      filtered = filtered.filter(alert => alert.sport === filters.sport)
    }
    
    if (filters.type) {
      filtered = filtered.filter(alert => alert.type.includes(filters.type))
    }
    
    setFilteredAlerts(filtered)
  }, [alerts, filters])

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data)
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAlertAction = async (alertId: string, action: 'ACK' | 'MUTE' | 'RESENT') => {
    setActionLoading(alertId)
    
    try {
      const response = await fetch('/api/admin/alerts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId,
          action,
          reason: `${action} by ${session?.user?.email}`
        }),
      })

      if (response.ok) {
        fetchAlerts() // Refresh the list
      }
    } catch (error) {
      console.error('Failed to update alert:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'ACKED': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'MUTED': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'RESENT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getSportBadge = (sport: string) => {
    switch (sport) {
      case 'MLB': return 'bg-emerald-500/20 text-emerald-400'
      case 'NFL': return 'bg-blue-500/20 text-blue-400'
      case 'NBA': return 'bg-orange-500/20 text-orange-400'
      case 'NHL': return 'bg-purple-500/20 text-purple-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 90) return 'text-red-500'
    if (priority >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  const uniqueSports = [...new Set(alerts.map(alert => alert.sport))]
  const uniqueTypes = [...new Set(alerts.map(alert => alert.type))]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alerts Management</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage system alerts with ACK/MUTE/RESEND actions
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {filteredAlerts.length} alerts
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 bg-card/25 backdrop-blur-sm border-b border-border">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKED">Acknowledged</option>
              <option value="MUTED">Muted</option>
              <option value="RESENT">Resent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sport</label>
            <select
              value={filters.sport}
              onChange={(e) => setFilters({...filters, sport: e.target.value})}
              className="px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Sports</option>
              {uniqueSports.map(sport => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({...filters, type: e.target.value})}
              className="px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <main className="p-6">
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`text-xs px-2 py-1 rounded border ${getStatusBadge(alert.status)}`}>
                        {alert.status}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${getSportBadge(alert.sport)}`}>
                        {alert.sport}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {alert.type}
                      </span>
                      <span className={`text-xs font-semibold ${getPriorityColor(alert.priority)}`}>
                        P{alert.priority}
                      </span>
                    </div>
                    
                    <p className="text-sm font-medium mb-1">{alert.message}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>Game: {alert.gameId}</span>
                      <span>Confidence: {alert.confidence}%</span>
                      <span>Created: {formatDistanceToNow(new Date(alert.createdAt))} ago</span>
                      {alert.source && <span>Source: {alert.source}</span>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {session?.user?.role !== 'VIEWER' && alert.status === 'OPEN' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlertAction(alert.id, 'ACK')}
                          disabled={actionLoading === alert.id}
                          className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          ACK
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlertAction(alert.id, 'MUTE')}
                          disabled={actionLoading === alert.id}
                          className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                        >
                          <Volume2 className="w-4 h-4 mr-1" />
                          MUTE
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlertAction(alert.id, 'RESENT')}
                          disabled={actionLoading === alert.id}
                          className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          RESEND
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredAlerts.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No alerts found matching your filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}