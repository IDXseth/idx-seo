import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canWrite } from '@/lib/access'
import { computeNextRunAt, SCHEDULE_TIMEZONE } from '@/lib/schedule-time'

// GET /api/schedules?batchId=X
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId')
  if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 })

  const batch = await prisma.batch.findUnique({ where: { id: batchId }, select: { userId: true } })
  if (!batch || !canWrite(session.user.id, session.user.email, batch.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const schedules = await prisma.schedule.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(schedules)
}

// POST /api/schedules  — create schedule
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  // `hour` is local time in this deployment's schedule time zone (default Arizona).
  const { batchId, frequency, customDays, dayOfWeek, dayOfMonth, hour = 9 } = body
  const timezone = SCHEDULE_TIMEZONE

  if (!batchId || !frequency) return NextResponse.json({ error: 'batchId and frequency required' }, { status: 400 })

  const batch = await prisma.batch.findUnique({ where: { id: batchId } })
  if (!batch || !canWrite(session.user.id, session.user.email, batch.userId)) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const nextRunAt = computeNextRunAt({ frequency, customDays, dayOfWeek, dayOfMonth, hour }, timezone)

  const schedule = await prisma.schedule.create({
    data: { batchId, frequency, customDays, dayOfWeek, dayOfMonth, hour, timezone, nextRunAt },
  })

  return NextResponse.json(schedule)
}

// PATCH /api/schedules?id=X  — toggle enabled or update
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json().catch(() => ({}))

  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: { batch: { select: { userId: true } } },
  })
  if (!existing || !canWrite(session.user.id, session.user.email, existing.batch.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.schedule.update({
    where: { id },
    data: {
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.frequency ? {
        frequency: body.frequency,
        customDays: body.customDays ?? null,
        dayOfWeek: body.dayOfWeek ?? null,
        dayOfMonth: body.dayOfMonth ?? null,
        hour: body.hour ?? existing.hour,
        timezone: SCHEDULE_TIMEZONE,
        nextRunAt: computeNextRunAt({
          frequency: body.frequency,
          customDays: body.customDays,
          dayOfWeek: body.dayOfWeek,
          dayOfMonth: body.dayOfMonth,
          hour: body.hour ?? existing.hour,
        }, SCHEDULE_TIMEZONE),
      } : {}),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/schedules?id=X
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: { batch: { select: { userId: true } } },
  })
  if (!existing || !canWrite(session.user.id, session.user.email, existing.batch.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.schedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
