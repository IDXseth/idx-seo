export const KNOWN_LEVELS_OF_CARE = [
  'Assisted Living',
  'Independent Living',
  'Memory Care',
  'Skilled Nursing',
  'Short Term Care',
]

const CARE_ALIASES: Record<string, string> = {
  'al': 'Assisted Living',
  'assisted': 'Assisted Living',
  'assisted living': 'Assisted Living',
  'il': 'Independent Living',
  'independent': 'Independent Living',
  'independent living': 'Independent Living',
  'mc': 'Memory Care',
  'memory': 'Memory Care',
  'memory care': 'Memory Care',
  'dementia': 'Memory Care',
  'dementia care': 'Memory Care',
  'sn': 'Skilled Nursing',
  'skilled': 'Skilled Nursing',
  'skilled nursing': 'Skilled Nursing',
  'snf': 'Skilled Nursing',
  'stc': 'Short Term Care',
  'short term': 'Short Term Care',
  'short term care': 'Short Term Care',
  'respite': 'Short Term Care',
  'respite care': 'Short Term Care',
}

export function toTitleCase(s: string): string {
  if (!s) return ''
  return s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export function normalizeLevelOfCare(raw: string): { value: string; isKnown: boolean } {
  if (!raw?.trim()) return { value: '', isKnown: true }
  const lower = raw.trim().toLowerCase()
  const canonical = KNOWN_LEVELS_OF_CARE.find((k) => k.toLowerCase() === lower)
  if (canonical) return { value: canonical, isKnown: true }
  const alias = CARE_ALIASES[lower]
  if (alias) return { value: alias, isKnown: true }
  return { value: toTitleCase(raw), isKnown: false }
}

export function normalizePromptType(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/[-_\s]+/g, '')
  return lower === 'brand' ? 'brand' : 'nonbrand'
}

// Spreadsheet column names accepted for each field, generic names first.
// Shared by the upload preview and the upload API so both read a file the same way.
export const COLUMN_ALIASES = {
  promptType: ['prompt_type', 'type', 'promptType'],
  category: ['category'],
  communityName: ['entity', 'entity_name', 'location', 'community_name', 'community', 'communityName'],
  city: ['city'],
  market: ['market'],
  levelOfCare: ['service', 'level_of_care', 'care_level', 'levelOfCare'],
  promptText: ['prompt', 'prompt_text', 'promptText'],
} as const

// The care-level clean-up (aliases like "AL" → Assisted Living) is senior-living
// vocabulary; other industries keep their service values as written.
export function normalizeRow(raw: {
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  promptText: string
}, options: { seniorLiving?: boolean } = {}): {
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  promptText: string
  isUnknownCare: boolean
} {
  const seniorLiving = options.seniorLiving ?? true
  const care = seniorLiving
    ? normalizeLevelOfCare(raw.levelOfCare)
    : { value: raw.levelOfCare?.trim() ?? '', isKnown: true }
  return {
    promptType: normalizePromptType(raw.promptType || 'nonbrand'),
    category: toTitleCase(raw.category),
    communityName: toTitleCase(raw.communityName),
    city: toTitleCase(raw.city),
    market: toTitleCase(raw.market),
    levelOfCare: care.value,
    promptText: raw.promptText.trim(),
    isUnknownCare: care.isKnown === false,
  }
}

// Maps the senior-living columns onto the brand-agnostic Prompt.entityName /
// Prompt.segments fields. Written alongside the legacy columns until they're dropped.
export function toGenericFields(row: {
  communityName: string
  city: string
  market: string
  levelOfCare: string
}): { entityName: string; segments: Record<string, string> } {
  const segments: Record<string, string> = {}
  if (row.market) segments.market = row.market
  if (row.city) segments.city = row.city
  if (row.levelOfCare) segments.levelOfCare = row.levelOfCare
  return { entityName: row.communityName, segments }
}
