import { CORS_HEADERS, oauthJson, originFromHeaders, protectedResourceMetadata } from '@/lib/mcp/oauth'

// RFC 9728 protected resource metadata for /api/mcp. The optional catch-all
// also answers the path-suffixed form (/.well-known/oauth-protected-resource/api/mcp).
export async function GET(req: Request) {
  return oauthJson(protectedResourceMetadata(originFromHeaders(req.headers)))
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
