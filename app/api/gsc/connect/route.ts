import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { buildGscAuthUrl } from '@/lib/gsc'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/gsc/callback`
  const url = buildGscAuthUrl(redirectUri)

  return redirect(url)
}
