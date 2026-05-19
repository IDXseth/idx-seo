import { google } from 'googleapis'
import { prisma } from './prisma'

const SITE_URL = 'https://www.seniorlifestyle.com'

export interface GscData {
  isIndexed: boolean
  impressions: number
  clicks: number
  position: number | null
  fetchedAt: Date
}

async function getGscOAuth2Client() {
  const account = await prisma.account.findFirst({
    where: {
      provider: 'google',
      scope: { contains: 'webmasters' },
      refresh_token: { not: null },
    },
    select: {
      refresh_token: true,
      access_token: true,
      expires_at: true,
    },
  })

  if (!account?.refresh_token) return null

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  })
  return oauth2
}

export async function refreshGscCache(): Promise<{ pagesUpdated: number; error?: string }> {
  const auth = await getGscOAuth2Client()
  if (!auth) {
    return {
      pagesUpdated: 0,
      error:
        'No Google account with Search Console access found. Sign in with Google and grant the webmasters.readonly scope.',
    }
  }

  const sc = google.searchconsole({ version: 'v1', auth })

  const today = new Date()
  const endDate = today.toISOString().slice(0, 10)
  const startDate = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let rows: Array<{ keys?: string[] | null; impressions?: number | null; clicks?: number | null; position?: number | null }> = []
  try {
    const res = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 5000,
      },
    })
    rows = res.data.rows ?? []
  } catch (err) {
    return {
      pagesUpdated: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const now = new Date()
  let pagesUpdated = 0

  for (const row of rows) {
    const pageUrl = row.keys?.[0]
    if (!pageUrl) continue

    const data = {
      isIndexed: (row.impressions ?? 0) > 0,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      position: row.position ?? null,
      fetchedAt: now,
      updatedAt: now,
    }

    await prisma.gscMetric.upsert({
      where: { pageUrl },
      create: { pageUrl, ...data },
      update: data,
    })
    pagesUpdated++
  }

  return { pagesUpdated }
}

export async function getGscMetrics(): Promise<Map<string, GscData>> {
  const records = await prisma.gscMetric.findMany()
  return new Map(
    records.map((r) => [
      r.pageUrl,
      {
        isIndexed: r.isIndexed,
        impressions: r.impressions,
        clicks: r.clicks,
        position: r.position,
        fetchedAt: r.fetchedAt,
      },
    ])
  )
}
