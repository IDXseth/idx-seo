import { cleanTerms, normalizeDomain } from './detection'

// Parses the project form (create and edit). List fields accept an array or a
// comma/newline-separated string.

export interface ProjectSettingsInput {
  name: string
  primaryDomain: string
  brandNames: string[]
  additionalDomains: string[]
  sitemapUrl: string | null
  sitemapPathPrefix: string | null
}

export interface CompetitorInputRow {
  brandName: string
  domain: string
  aliases: string
}

function list(value: unknown): string[] {
  const items = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[,\n]/)
  return cleanTerms(items)
}

function optional(value: unknown): string | null {
  const s = String(value ?? '').trim()
  return s || null
}

export function parseProjectSettings(body: Record<string, unknown>): { data?: ProjectSettingsInput; error?: string } {
  const name = String(body.name ?? '').trim()
  const primaryDomain = normalizeDomain(String(body.primaryDomain ?? ''))
  if (!name) return { error: 'Project name is required' }
  if (!primaryDomain || !primaryDomain.includes('.')) return { error: 'A valid primary domain is required (e.g. example.com)' }
  const brandNames = list(body.brandNames)
  return {
    data: {
      name,
      primaryDomain,
      // The brand name is what gets matched in AI answers; default to the project name.
      brandNames: brandNames.length > 0 ? brandNames : [name],
      additionalDomains: cleanTerms(list(body.additionalDomains).map(normalizeDomain)).filter((d) => d !== primaryDomain),
      sitemapUrl: optional(body.sitemapUrl),
      sitemapPathPrefix: optional(body.sitemapPathPrefix),
    },
  }
}

export function parseCompetitors(value: unknown): CompetitorInputRow[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      const r = (row ?? {}) as Record<string, unknown>
      return {
        brandName: String(r.brandName ?? '').trim(),
        domain: normalizeDomain(String(r.domain ?? '')),
        aliases: list(r.aliases).join(', '),
      }
    })
    .filter((c) => c.brandName && c.domain)
}
