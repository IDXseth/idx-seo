import { APP_TITLE } from '@/lib/app-config'
import { CORS_HEADERS, originFromHeaders, protectedResourceMetadataUrl, viewerFromBearer } from '@/lib/mcp/oauth'
import { callTool, toolList } from '@/lib/mcp/tools'

// MCP server (Streamable HTTP transport, stateless, JSON responses) exposing
// read-only AI Visibility Dashboard data. Add it to Claude as a custom
// connector with the URL https://<this deployment>/api/mcp — Claude runs the
// OAuth flow in lib/mcp/oauth.ts and every call acts as the approving user.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'ai-visibility-dashboard', title: APP_TITLE, version: '1.0.0' }
const INSTRUCTIONS =
  'Read-only access to the AI Visibility Dashboard: how often AI assistants (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) mention and cite a brand for tracked prompts, versus its competitors. Start with list_projects to get a project_id. Rates are fractions from 0 to 1. Results aggregate every run unless run_session_id is given ("latest" = newest snapshot).'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS, ...headers },
  })
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } }
}

function unauthorized(req: Request) {
  const metadata = protectedResourceMetadataUrl(originFromHeaders(req.headers))
  return json(
    { error: 'invalid_token', error_description: 'Sign in to the AI Visibility Dashboard to use this connector' },
    401,
    { 'WWW-Authenticate': `Bearer resource_metadata="${metadata}"` }
  )
}

export async function POST(req: Request) {
  const viewer = await viewerFromBearer(req.headers.get('authorization'))
  if (!viewer) return unauthorized(req)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400)
  }

  const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[]
  const responses = []

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      // Responses from the client (to server requests we never send) or junk.
      if (msg && typeof msg === 'object' && 'id' in msg && !('method' in msg)) continue
      responses.push(rpcError(null, -32600, 'Invalid Request'))
      continue
    }
    // Notifications (no id) get no response.
    const isNotification = msg.id === undefined
    const params = msg.params ?? {}

    switch (msg.method) {
      case 'initialize': {
        const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
        responses.push({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          },
        })
        break
      }
      case 'ping':
        if (!isNotification) responses.push({ jsonrpc: '2.0', id: msg.id, result: {} })
        break
      case 'tools/list':
        responses.push({ jsonrpc: '2.0', id: msg.id, result: { tools: toolList() } })
        break
      case 'tools/call': {
        const name = typeof params.name === 'string' ? params.name : ''
        const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>
        const result = await callTool(viewer, name, args)
        responses.push(result ? { jsonrpc: '2.0', id: msg.id, result } : rpcError(msg.id, -32602, `Unknown tool: ${name}`))
        break
      }
      case 'resources/list':
        responses.push({ jsonrpc: '2.0', id: msg.id, result: { resources: [] } })
        break
      case 'prompts/list':
        responses.push({ jsonrpc: '2.0', id: msg.id, result: { prompts: [] } })
        break
      default:
        if (!isNotification && !msg.method.startsWith('notifications/')) {
          responses.push(rpcError(msg.id, -32601, `Method not found: ${msg.method}`))
        }
    }
  }

  if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS })
  return json(Array.isArray(body) ? responses : responses[0])
}

// Stateless server: no server-initiated SSE stream and no sessions to end.
export async function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } })
}

export async function DELETE() {
  return new Response('Method Not Allowed', { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
