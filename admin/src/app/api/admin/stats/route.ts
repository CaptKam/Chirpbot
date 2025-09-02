import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { alerts, healthSnapshots } from '../../../../../shared/schema'
import { eq, and, gte, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'OPERATOR', 'VIEWER'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get today's date for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get alert statistics
    const openAlertsCount = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(alerts)
      .where(eq(alerts.status, 'OPEN'))

    const mutedTodayCount = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(alerts)
      .where(and(
        eq(alerts.status, 'MUTED'),
        gte(alerts.updatedAt, today)
      ))

    const resentTodayCount = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(alerts)
      .where(and(
        eq(alerts.status, 'RESENT'),
        gte(alerts.updatedAt, today)
      ))

    // Get system health statistics
    const healthComponents = await db
      .select()
      .from(healthSnapshots)
      .where(sql`created_at >= NOW() - INTERVAL '10 minutes'`)
      .orderBy(sql`created_at DESC`)

    // Count unique components that are UP
    const uniqueComponents = new Map()
    healthComponents.forEach(snapshot => {
      if (!uniqueComponents.has(snapshot.component)) {
        uniqueComponents.set(snapshot.component, snapshot.status)
      }
    })

    const componentsUp = Array.from(uniqueComponents.values()).filter(status => status === 'UP').length
    const componentsTotal = Math.max(uniqueComponents.size, 6) // At least 6 expected components

    return NextResponse.json({
      openAlerts: openAlertsCount[0]?.count || 0,
      mutedToday: mutedTodayCount[0]?.count || 0,
      resentToday: resentTodayCount[0]?.count || 0,
      componentsUp,
      componentsTotal
    })
  } catch (error) {
    console.error('Failed to fetch admin stats:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}