import * as XLSX from 'xlsx'

export interface ScreamingFrogRow {
  url: string
  statusCode: number | null
  indexability: string | null
  indexabilityStatus: string | null
  title: string | null
  titleLength: number | null
  metaDescription: string | null
  metaDescriptionLength: number | null
  h1: string | null
  wordCount: number | null
  canonicalUrl: string | null
  inlinks: number | null
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '_')
}

function getField(row: Record<string, unknown>, normalized: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = normalized[normalizeKey(key)]
    if (val !== undefined && val !== null && val !== '') return String(val).trim()
  }
  return ''
}

function toInt(value: string): number | null {
  if (!value) return null
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

// Parses a Screaming Frog "Internal:All" (or "Internal:HTML") export, CSV or XLSX.
export function parseScreamingFrogExport(buffer: ArrayBuffer): ScreamingFrogRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, unknown>[]

  return rows
    .map((row) => {
      const normalized = Object.keys(row).reduce((acc, k) => {
        acc[normalizeKey(k)] = row[k]
        return acc
      }, {} as Record<string, unknown>)

      const url = getField(row, normalized, 'address', 'url')
      if (!url) return null

      const titleLengthRaw = getField(row, normalized, 'title_1_length', 'title_length')
      const metaLengthRaw = getField(row, normalized, 'meta_description_1_length', 'meta_description_length')

      return {
        url,
        statusCode: toInt(getField(row, normalized, 'status_code')),
        indexability: getField(row, normalized, 'indexability') || null,
        indexabilityStatus: getField(row, normalized, 'indexability_status') || null,
        title: getField(row, normalized, 'title_1', 'title') || null,
        titleLength: toInt(titleLengthRaw),
        metaDescription: getField(row, normalized, 'meta_description_1', 'meta_description') || null,
        metaDescriptionLength: toInt(metaLengthRaw),
        h1: getField(row, normalized, 'h1_1', 'h1') || null,
        wordCount: toInt(getField(row, normalized, 'word_count')),
        canonicalUrl: getField(row, normalized, 'canonical_link_element_1', 'canonical') || null,
        inlinks: toInt(getField(row, normalized, 'unique_inlinks', 'inlinks')),
      }
    })
    .filter((r): r is ScreamingFrogRow => r !== null)
}
