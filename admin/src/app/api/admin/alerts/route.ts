import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { alerts } from '../../../../../shared/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'OPERATOR', 'VIEWER'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const sport = searchParams.get('sport')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  try {
    let whereClause = sql`1=1`
    
    if (status) {
      whereClause = and(whereClause, eq(alerts.status, status))
    }
    if (sport) {
      whereClause = and(whereClause, eq(alerts.sport, sport.toUpperCase()))
    }

    const alertsList = await db
      .select()
      .from(alerts)
      .where(whereClause)
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)

    return NextResponse.json(alertsList)
  } catch (error) {
    console.error('Failed to fetch alerts:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'OPERATOR'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { alertId, action, reason } = body

    if (!alertId || !action || !['ACK', 'MUTE', 'RESENT'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const result = await db
      .update(alerts)
      .set({ 
        status: action === 'ACK' ? 'ACKED' : action === 'MUTE' ? 'MUTED' : 'RESENT',
        updatedAt: new Date()
      })
      .where(eq(alerts.id, alertId))
      .returning()

    // TODO: Add audit log entry
    // TODO: Send to WebSocket clients

    return NextResponse.json({ success: true, alert: result[0] })
  } catch (error) {
    console.error('Failed to update alert:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}