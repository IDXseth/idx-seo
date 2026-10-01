import { sendRunCompleteEmail } from '@/lib/email'
import { getViewer } from '@/lib/access'

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    // Only ever notify the signed-in user — this must not relay mail to arbitrary addresses.
    await sendRunCompleteEmail({ ...body, to: viewer.email })
    return Response.json({ ok: true })
  } catch (error) {
    console.error('Notify error:', error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
