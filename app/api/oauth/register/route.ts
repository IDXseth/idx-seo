import { prisma } from '@/lib/prisma'
import { CORS_HEADERS, isAllowedRedirectUri, oauthError, oauthJson } from '@/lib/mcp/oauth'

// RFC 7591 dynamic client registration. Registering grants nothing by itself:
// a client only gets tokens after a signed-in user approves it at /oauth/authorize.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return oauthError('invalid_client_metadata', 'Body must be JSON')

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : []
  if (redirectUris.length === 0 || redirectUris.length > 10) {
    return oauthError('invalid_redirect_uri', 'Provide between 1 and 10 redirect_uris')
  }
  const bad = redirectUris.find((u) => !isAllowedRedirectUri(u))
  if (bad) return oauthError('invalid_redirect_uri', `Redirect URI must be https or loopback http: ${bad}`)

  const method = body.token_endpoint_auth_method ?? 'none'
  if (method !== 'none') {
    return oauthError('invalid_client_metadata', 'Only public clients (token_endpoint_auth_method "none") are supported')
  }

  const name = (typeof body.client_name === 'string' && body.client_name.trim()) || 'MCP client'
  const client = await prisma.oAuthClient.create({
    data: { name: name.slice(0, 100), redirectUris },
  })

  return oauthJson(
    {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    201
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
