// Validated categorical palette (dataviz skill default order, checked against
// this app's white card surface with scripts/validate_palette.js) — "Your
// Brand" always takes slot 1, competitors take the next slots in stable
// order. Shared by every brand-comparison chart so a given brand always
// renders in the same color, whichever chart it appears in.
export const BRAND_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

// Fixed per-brand assignment (by stable array position, never by which
// brands are currently toggled on) so a brand keeps its color no matter
// what else is shown or hidden.
export function brandColorMap(brandIds: string[]): Map<string, string> {
  return new Map(brandIds.map((id, i) => [id, BRAND_PALETTE[i % BRAND_PALETTE.length]]))
}
