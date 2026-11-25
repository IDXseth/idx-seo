import { authorizationServerMetadata, CORS_HEADERS, oauthJson, originFromHeaders } from '@/lib/mcp/oauth'

// Some MCP clients look for OpenID discovery instead of RFC 8414 metadata.
export async function GET(req: Request) {
  return oauthJson(authorizationServerMetadata(originFromHeaders(req.headers)))
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
