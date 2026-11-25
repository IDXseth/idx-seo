import { prisma } from '../prisma'
import { MCP_SCOPE, redirectUriMatches } from './oauth'

export interface AuthorizeParams {
  response_type?: string
  client_id?: string
  redirect_uri?: string
  code_challenge?: string
  code_challenge_method?: string
  state?: string
  scope?: string
  resource?: string
}

export type AuthorizeCheck =
  // client_id or redirect_uri can't be trusted: show the error, never redirect (RFC 6749 §4.1.2.1)
  | { kind: 'fatal'; message: string }
  // the client is known: errors go back to it on its redirect_uri
  | { kind: 'redirect-error'; redirectUri: string; error: string; description: string; state?: string }
  | { kind: 'ok'; clientId: string; clientName: string; redirectUri: string; codeChallenge: string; scope: string; state?: string }

export const AUTHORIZE_PARAM_KEYS: (keyof AuthorizeParams)[] = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'scope',
  'resource',
]

export async function checkAuthorizeRequest(p: AuthorizeParams): Promise<AuthorizeCheck> {
  if (!p.client_id) return { kind: 'fatal', message: 'Missing client_id.' }
  const client = await prisma.oAuthClient.findUnique({ where: { id: p.client_id } })
  if (!client) return { kind: 'fatal', message: 'This app is not registered. Remove the connector and add it again.' }
  if (!p.redirect_uri || !redirectUriMatches(client.redirectUris, p.redirect_uri)) {
    return { kind: 'fatal', message: 'The redirect address does not match what this app registered.' }
  }

  const back = (error: string, description: string): AuthorizeCheck => ({
    kind: 'redirect-error',
    redirectUri: p.redirect_uri!,
    error,
    description,
    state: p.state,
  })
  if (p.response_type !== 'code') return back('unsupported_response_type', 'response_type must be "code"')
  if (!p.code_challenge || p.code_challenge_method !== 'S256') {
    return back('invalid_request', 'PKCE with code_challenge_method S256 is required')
  }
  const requested = (p.scope ?? '').split(/\s+/).filter(Boolean)
  if (requested.some((s) => s !== MCP_SCOPE)) return back('invalid_scope', `Only the "${MCP_SCOPE}" scope is supported`)

  return {
    kind: 'ok',
    clientId: client.id,
    clientName: client.name,
    redirectUri: p.redirect_uri,
    codeChallenge: p.code_challenge,
    scope: MCP_SCOPE,
    state: p.state,
  }
}

export function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v)
  return url.toString()
}
