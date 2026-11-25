import type { IndustryPreset } from './segment-labels'

// Prompt-suggestion categories per industry preset. Client-safe (the upload
// panel shows them as toggles), separate from the server-only generator.

export const SENIOR_LIVING_CATEGORIES = [
  'General Discovery',
  'Care Specific',
  'Cost & Financial Planning',
  'Location Based',
  'Best Of',
  'Competitor / Options Comparison',
  'Caregiver & Family Support',
  'Daily Life & Amenities',
  'Policy & Logistics',
  'Reviews & Reputation',
] as const

export const GENERAL_CATEGORIES = [
  'General Discovery',
  'Service Specific',
  'Cost & Pricing',
  'Location Based',
  'Best Of',
  'Competitor / Options Comparison',
  'Reviews & Reputation',
  'How-To & Advice',
] as const

export function categoriesFor(preset: IndustryPreset): readonly string[] {
  return preset === 'senior-living' ? SENIOR_LIVING_CATEGORIES : GENERAL_CATEGORIES
}
