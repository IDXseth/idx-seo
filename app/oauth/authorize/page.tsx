import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/access'
import { APP_TITLE } from '@/lib/app-config'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AUTHORIZE_PARAM_KEYS, checkAuthorizeRequest, redirectWith, type AuthorizeParams } from '@/lib/mcp/authorize-request'
import { decideAuthorization } from './actions'

export const dynamic = 'force-dynamic'

// OAuth consent screen for the MCP connector. An MCP client (e.g. a Claude
// connector) sends the user here; once they sign in and approve, the client
// can read the same dashboard data this user sees, nothing more.
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const params: AuthorizeParams = {}
  for (const key of AUTHORIZE_PARAM_KEYS) {
    const v = raw[key]
    if (typeof v === 'string' && v) params[key] = v
  }

  const check = await checkAuthorizeRequest(params)
  if (check.kind === 'fatal') {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Card>
          <CardHeader>
            <CardTitle>Can&apos;t connect this app</CardTitle>
            <CardDescription>{check.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }
  if (check.kind === 'redirect-error') {
    redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.description, state: check.state }))
  }

  const viewer = await getViewer()
  if (!viewer) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${query}`)}`)
  }

  const redirectHost = new URL(check.redirectUri).host

  return (
    <div className="max-w-md mx-auto mt-16">
      <Card>
        <CardHeader>
          <CardTitle>Connect {check.clientName}?</CardTitle>
          <CardDescription>
            <strong>{check.clientName}</strong> wants read-only access to {APP_TITLE} as{' '}
            <strong>{viewer.email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>It can read the projects, prompts, AI responses, visibility scores and competitors you can already see.</li>
            <li>It can&apos;t run prompts, edit projects or change anything.</li>
            <li>You&apos;ll be sent back to <strong>{redirectHost}</strong>.</li>
          </ul>
          <form action={decideAuthorization} className="flex gap-3 justify-end">
            {AUTHORIZE_PARAM_KEYS.map((key) =>
              params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null
            )}
            <Button type="submit" name="decision" value="deny" variant="outline">
              Deny
            </Button>
            <Button type="submit" name="decision" value="approve">
              Allow
            </Button>
          </form>
          <p className="text-xs opacity-70">Only approve apps you added yourself. Only connect from Claude accounts you trust.</p>
        </CardContent>
      </Card>
    </div>
  )
}
