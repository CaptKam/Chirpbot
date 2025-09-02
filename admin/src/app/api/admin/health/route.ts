import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { healthSnapshots } from '../../../../../shared/schema'
import { desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'OPERATOR', 'VIEWER'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get latest health snapshot for each component
    const latestHealthSnapshots = await db
      .select()
      .from(healthSnapshots)
      .where(sql`created_at >= NOW() - INTERVAL '1 hour'`)
      .orderBy(desc(healthSnapshots.createdAt))

    // Group by component and get the most recent for each
    const componentHealth = new Map()
    latestHealthSnapshots.forEach(snapshot => {
      if (!componentHealth.has(snapshot.component)) {
        componentHealth.set(snapshot.component, {
          component: snapshot.component,
          status: snapshot.status,
          detail: snapshot.detail,
          lastUpdated: snapshot.createdAt,
        })
      }
    })

    // Add default components if not found in database
    const expectedComponents = ['statsapi', 'espn', 'weather', 'telegram', 'queue', 'worker']
    expectedComponents.forEach(component => {
      if (!componentHealth.has(component)) {
        componentHealth.set(component, {
          component: component,
          status: 'UNKNOWN',
          detail: { message: 'No recent health checks' },
          lastUpdated: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        })
      }
    })

    return NextResponse.json(Array.from(componentHealth.values()))
  } catch (error) {
    console.error('Failed to fetch health status:', error)
    return NextResponse.json({ error: 'Failed to fetch health status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'OPERATOR'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { component, status, detail } = body

    if (!component || !status || !['UP', 'DOWN', 'DEGRADED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const result = await db
      .insert(healthSnapshots)
      .values({
        component,
        status,
        detail: detail || null,
      })
      .returning()

    return NextResponse.json({ success: true, snapshot: result[0] })
  } catch (error) {
    console.error('Failed to create health snapshot:', error)
    return NextResponse.json({ error: 'Failed to create health snapshot' }, { status: 500 })
  }
}