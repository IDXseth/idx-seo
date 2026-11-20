import { prisma } from '@/lib/prisma'
import {
  CORS_HEADERS,
  issueTokens,
  oauthError,
  oauthJson,
  readParams,
  redirectUriMatches,
  sha256,
  verifyPkce,
} from '@/lib/mcp/oauth'

export async function POST(req: Request) {
  const params = await readParams(req)
  const grantType = params.grant_type

  if (grantType === 'authorization_code') {
    const { code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId } = params
    if (!code || !verifier || !redirectUri || !clientId) {
      return oauthError('invalid_request', 'code, code_verifier, redirect_uri and client_id are required')
    }

    const stored = await prisma.oAuthAuthCode.findUnique({ where: { codeHash: sha256(code) } })
    if (!stored || stored.clientId !== clientId) return oauthError('invalid_grant', 'Unknown authorization code')

    // Mark the code used first, atomically, so a replayed code can't win a race.
    const claimed = await prisma.oAuthAuthCode.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (claimed.count === 0) {
      // Code reuse: revoke whatever the code already produced (OAuth 2.1, section 4.1.3).
      await prisma.oAuthToken.updateMany({
        where: { clientId, userId: stored.userId, createdAt: { gte: stored.createdAt }, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      return oauthError('invalid_grant', 'Authorization code already used')
    }
    if (stored.expiresAt.getTime() < Date.now()) return oauthError('invalid_grant', 'Authorization code expired')
    if (!redirectUriMatches([stored.redirectUri], redirectUri)) return oauthError('invalid_grant', 'redirect_uri mismatch')
    if (!verifyPkce(verifier, stored.codeChallenge)) return oauthError('invalid_grant', 'PKCE verification failed')

    return oauthJson(await issueTokens(clientId, stored.userId, stored.scope))
  }

  if (grantType === 'refresh_token') {
    const { refresh_token: refreshToken, client_id: clientId } = params
    if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required')

    const stored = await prisma.oAuthToken.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } })
    if (!stored || (clientId && stored.clientId !== clientId)) return oauthError('invalid_grant', 'Unknown refresh token')
    if (stored.revokedAt || stored.refreshExpiresAt.getTime() < Date.now()) {
      return oauthError('invalid_grant', 'Refresh token expired or revoked')
    }

    // Rotate: the old pair stops working the moment a new one is issued.
    const revoked = await prisma.oAuthToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (revoked.count === 0) return oauthError('invalid_grant', 'Refresh token already used')

    return oauthJson(await issueTokens(stored.clientId, stored.userId, stored.scope))
  }

  return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token')
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
