import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? ''
  const host = dbUrl.split('@')[1]?.split('/')[0] ?? 'unknown'
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'connected', host })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message, host }, { status: 500 })
  }
}
