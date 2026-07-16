import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Reset token is required' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!resetToken || resetToken.expires < new Date()) {
      if (resetToken) await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return NextResponse.json({ error: 'This reset link is invalid or has expired' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Reset-password error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
