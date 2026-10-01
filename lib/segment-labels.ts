// How a project names the dimensions its prompts are tagged with. Prompts keep
// the same columns for every project (entity = Prompt.communityName/entityName,
// levelOfCare, market, category); each project chooses what they're called.
// Stored in Project.segmentLabels. Client-safe: no server imports.

export type IndustryPreset = 'senior-living' | 'general'

export interface SegmentLabels {
  preset: IndustryPreset
  entity: string       // the brand's own location/product a prompt is about
  levelOfCare: string  // a service line / offering
  market: string
  category: string
}

export const PRESET_LABELS: Record<IndustryPreset, SegmentLabels> = {
  'senior-living': { preset: 'senior-living', entity: 'Community', levelOfCare: 'Level of Care', market: 'Market', category: 'Category' },
  general: { preset: 'general', entity: 'Location', levelOfCare: 'Service', market: 'Market', category: 'Category' },
}

export const PRESET_NAMES: Record<IndustryPreset, string> = {
  'senior-living': 'Senior living',
  general: 'General',
}

// Merges a project's stored labels over its preset's defaults. Projects saved
// before labels existed default to general; data outside any project is the
// original senior-living setup.
export function resolveSegmentLabels(stored: unknown, fallbackPreset: IndustryPreset = 'general'): SegmentLabels {
  const raw = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>
  const preset: IndustryPreset = raw.preset === 'senior-living' || raw.preset === 'general' ? raw.preset : fallbackPreset
  const base = PRESET_LABELS[preset]
  const pick = (key: keyof Omit<SegmentLabels, 'preset'>) =>
    typeof raw[key] === 'string' && (raw[key] as string).trim() ? (raw[key] as string).trim() : base[key]
  return { preset, entity: pick('entity'), levelOfCare: pick('levelOfCare'), market: pick('market'), category: pick('category') }
}
