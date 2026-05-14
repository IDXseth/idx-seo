import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.DIRECT_URL
    ? `DIRECT_URL set (${process.env.DIRECT_URL.split('@')[1] ?? 'hidden'})`
    : `DATABASE_URL only (${(process.env.DATABASE_URL ?? '').split('@')[1] ?? 'hidden'})`
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'connected', using: url })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message, using: url }, { status: 500 })
  }
}
