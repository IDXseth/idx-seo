import { prisma } from '@/lib/prisma'
import { CORS_HEADERS, readParams, sha256 } from '@/lib/mcp/oauth'

// RFC 7009 token revocation. Accepts either the access or the refresh token
// and always answers 200, as the spec requires.
export async function POST(req: Request) {
  const { token } = await readParams(req)
  if (token) {
    const hash = sha256(token)
    await prisma.oAuthToken.updateMany({
      where: { OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }], revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  return new Response(null, { status: 200, headers: CORS_HEADERS })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
