import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Always return a generic success response so this endpoint can't be
    // used to enumerate which emails have accounts.
    const genericResponse = NextResponse.json({
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return genericResponse

    const token = crypto.randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expires: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })

    const resetUrl = `${APP_URL}/reset-password?token=${token}`
    await sendPasswordResetEmail({ to: user.email, resetUrl })

    return genericResponse
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Forgot-password error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
