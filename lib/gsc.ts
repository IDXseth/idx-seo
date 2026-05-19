import { prisma } from './prisma'

export interface GscMetric {
  url: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  isIndexed: boolean
  fetchedAt: string
}

export interface GscStatus {
  connected: boolean
  siteUrl: string | null
  lastSynced: string | null
}

// ── Token management ─────────────────────────────────────────────────────────

async function refreshAccessToken(id: string, refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }

  await prisma.gscConnection.update({
    where: { id },
    data: {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  })

  return data.access_token
}

async function getAccessToken(): Promise<{ token: string; siteUrl: string } | null> {
  const conn = await prisma.gscConnection.findFirst()
  if (!conn) return null

  // Refresh if expiring within 60 seconds
  const token =
    conn.expiresAt.getTime() > Date.now() + 60_000
      ? conn.accessToken
      : await refreshAccessToken(conn.id, conn.refreshToken)

  return { token, siteUrl: conn.siteUrl }
}

// ── GSC API ──────────────────────────────────────────────────────────────────

const COMMUNITY_PATH = '/resources/senior-living/'

export async function syncGscMetrics(): Promise<{ synced: number; error: string | null }> {
  const auth = await getAccessToken()
  if (!auth) return { synced: 0, error: 'No GSC connection configured' }

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(auth.siteUrl)}/searchAnalytics/query`

  const body = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ['page'],
    rowLimit: 5000,
    dimensionFilterGroups: [{
      filters: [{
        dimension: 'page',
        operator: 'contains',
        expression: COMMUNITY_PATH,
      }],
    }],
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return { synced: 0, error: `GSC API error: ${res.status} — ${text.slice(0, 200)}` }
  }

  const data = await res.json() as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>
  }

  const rows = data.rows ?? []

  await Promise.all(
    rows.map(row => {
      const url = row.keys[0]
      const payload = {
        clicks: Math.round(row.clicks),
        impressions: Math.round(row.impressions),
        ctr: row.ctr,
        position: row.position,
        isIndexed: row.impressions > 0,
        fetchedAt: new Date(),
      }
      return prisma.gscPageMetric.upsert({
        where: { url },
        create: { url, ...payload },
        update: payload,
      })
    })
  )

  return { synced: rows.length, error: null }
}

// ── Status + metrics for dashboard ───────────────────────────────────────────

export async function getGscStatus(): Promise<GscStatus> {
  const conn = await prisma.gscConnection.findFirst({
    select: { siteUrl: true, updatedAt: true },
  })
  if (!conn) return { connected: false, siteUrl: null, lastSynced: null }

  const latest = await prisma.gscPageMetric.findFirst({
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  })

  return {
    connected: true,
    siteUrl: conn.siteUrl,
    lastSynced: latest?.fetchedAt.toISOString() ?? null,
  }
}

export async function getGscMetricsByUrl(): Promise<Map<string, GscMetric>> {
  const rows = await prisma.gscPageMetric.findMany()
  const map = new Map<string, GscMetric>()
  for (const row of rows) {
    map.set(row.url, {
      url: row.url,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      isIndexed: row.isIndexed,
      fetchedAt: row.fetchedAt.toISOString(),
    })
  }
  return map
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function buildGscAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent', // always return refresh token
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ siteUrl: string }> {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Code exchange failed: ${res.status} ${text}`)
  }

  const tokens = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned. Please revoke app access in your Google account and try again.')
  }

  const siteUrl = process.env.GSC_SITE_URL ?? 'https://www.seniorlifestyle.com/'

  // Upsert — only one connection record for the whole app
  const existing = await prisma.gscConnection.findFirst()
  if (existing) {
    await prisma.gscConnection.update({
      where: { id: existing.id },
      data: {
        siteUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
  } else {
    await prisma.gscConnection.create({
      data: {
        siteUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
  }

  return { siteUrl }
}
