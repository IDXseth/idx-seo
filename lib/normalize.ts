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

export function normalizeRow(raw: {
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  promptText: string
}): {
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  promptText: string
  isUnknownCare: boolean
} {
  const care = normalizeLevelOfCare(raw.levelOfCare)
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
