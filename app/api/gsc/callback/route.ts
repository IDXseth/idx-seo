import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { exchangeCodeForTokens } from '@/lib/gsc'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return redirect(`/dashboard?gsc=error&reason=${encodeURIComponent(error ?? 'no_code')}`)
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const redirectUri = `${appUrl}/api/gsc/callback`
    await exchangeCodeForTokens(code, redirectUri)
    return redirect('/dashboard?gsc=connected')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return redirect(`/dashboard?gsc=error&reason=${encodeURIComponent(msg)}`)
  }
}
