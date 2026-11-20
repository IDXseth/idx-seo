'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { AUTH_CODE_TTL_SECONDS, randomToken, sha256 } from '@/lib/mcp/oauth'
import { AUTHORIZE_PARAM_KEYS, checkAuthorizeRequest, redirectWith, type AuthorizeParams } from '@/lib/mcp/authorize-request'

function paramsFrom(formData: FormData): AuthorizeParams {
  const p: AuthorizeParams = {}
  for (const key of AUTHORIZE_PARAM_KEYS) {
    const v = formData.get(key)
    if (typeof v === 'string' && v) p[key] = v
  }
  return p
}

// The consent form posts here. Everything is re-checked: the hidden fields
// came back from the browser and can't be trusted.
export async function decideAuthorization(formData: FormData) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')

  const check = await checkAuthorizeRequest(paramsFrom(formData))
  if (check.kind === 'fatal') throw new Error(check.message)
  if (check.kind === 'redirect-error') {
    redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.description, state: check.state }))
  }

  if (formData.get('decision') !== 'approve') {
    redirect(redirectWith(check.redirectUri, { error: 'access_denied', error_description: 'The user denied access', state: check.state }))
  }

  const code = randomToken()
  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: check.clientId,
      userId: viewer.id,
      redirectUri: check.redirectUri,
      codeChallenge: check.codeChallenge,
      scope: check.scope,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  })

  redirect(redirectWith(check.redirectUri, { code, state: check.state }))
}
