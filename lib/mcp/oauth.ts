import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '../prisma'
import type { Viewer } from '../access'

// OAuth 2.1 authorization server for the MCP connector (/api/mcp), so Claude
// connectors can act as a signed-in dashboard user. Flow:
//   1. Client registers itself:  POST /api/oauth/register (RFC 7591)
//   2. User approves it:         /oauth/authorize (NextAuth sign-in + consent)
//   3. Client swaps the code:    POST /api/oauth/token (PKCE S256 required)
//   4. Client calls /api/mcp with "Authorization: Bearer <access token>"
// Discovery: /.well-known/oauth-protected-resource and
// /.well-known/oauth-authorization-server. Tokens are opaque random strings;
// only their SHA-256 hashes are stored.

export const MCP_SCOPE = 'read'
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60            // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days, rotated on use
export const AUTH_CODE_TTL_SECONDS = 5 * 60

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

// PKCE S256: BASE64URL(SHA256(code_verifier)) must equal the stored challenge.
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const expected = Buffer.from(challenge)
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

// Public origin of this deployment, taken from the request so preview and
// production deployments each advertise their own URLs.
export function originFromHeaders(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!host) return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const proto =
    headers.get('x-forwarded-proto')?.split(',')[0].trim() ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function mcpResourceUrl(origin: string): string {
  return `${origin}/api/mcp`
}

export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource`
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [MCP_SCOPE],
  }
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'AI Visibility Dashboard',
  }
}

// Redirect URIs must be https, or http on a loopback host (for local MCP
// clients such as Claude Code). No fragments.
export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.hash) return false
  if (url.protocol === 'https:') return true
  if (url.protocol === 'http:') return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  return false
}

// Loopback redirect URIs may change port between runs (RFC 8252 §7.3).
export function redirectUriMatches(registered: string[], candidate: string): boolean {
  if (registered.includes(candidate)) return true
  let c: URL
  try {
    c = new URL(candidate)
  } catch {
    return false
  }
  if (c.protocol !== 'http:') return false
  return registered.some((r) => {
    try {
      const u = new URL(r)
      return u.protocol === 'http:' && u.hostname === c.hostname && u.pathname === c.pathname &&
        ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    } catch {
      return false
    }
  })
}

export async function issueTokens(clientId: string, userId: string, scope: string) {
  const accessToken = randomToken()
  const refreshToken = randomToken()
  const now = Date.now()
  await prisma.oAuthToken.create({
    data: {
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      clientId,
      userId,
      scope,
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  })
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope,
  }
}

// The dashboard user an MCP request acts as, or null when the bearer token is
// missing, unknown, expired or revoked. Access rules downstream are the same
// ones the web app applies to that user (lib/access.ts).
export async function viewerFromBearer(authorization: string | null): Promise<Viewer | null> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: sha256(match[1].trim()) },
    select: { revokedAt: true, accessExpiresAt: true, user: { select: { id: true, email: true } } },
  })
  if (!token || token.revokedAt || token.accessExpiresAt.getTime() < Date.now()) return null
  return { id: token.user.id, email: token.user.email?.toLowerCase() ?? null }
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

export function oauthJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS, ...extraHeaders },
  })
}

export function oauthError(error: string, description: string, status = 400): Response {
  return oauthJson({ error, error_description: description }, status)
}

// Token and revoke endpoints accept form-encoded bodies (the OAuth standard);
// JSON is tolerated for clients that send it.
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]))
  }
  const text = await req.text()
  return Object.fromEntries(new URLSearchParams(text))
}
