import { sendRunCompleteEmail } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    await sendRunCompleteEmail(body)
    return Response.json({ ok: true })
  } catch (error) {
    console.error('Notify error:', error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
