import { authorizationServerMetadata, CORS_HEADERS, oauthJson, originFromHeaders } from '@/lib/mcp/oauth'

// RFC 8414 authorization server metadata for the MCP connector's OAuth flow.
export async function GET(req: Request) {
  return oauthJson(authorizationServerMetadata(originFromHeaders(req.headers)))
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
