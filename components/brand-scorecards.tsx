import { Scorecard } from '@/components/scorecard'
import type { BrandSeries } from '@/lib/competitor-stats'

// Grid of per-brand mention/citation scorecards — the scorecard-based alternative
// to BrandComparisonChart's grouped bar chart. Trades the chart's per-platform
// breakdown for the same aggregate-rate-card look used for communities,
// categories, care levels, etc. elsewhere in the dashboard.
export function BrandScorecards({ brands, promptCount }: { brands: BrandSeries[]; promptCount: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {brands.map((b) => (
        <Scorecard
          key={b.id}
          title={b.label}
          subtitle={b.id === 'you' ? 'You' : undefined}
          mentionRate={b.overallMentionRate}
          citationRate={b.overallCitationRate}
          promptCount={promptCount}
        />
      ))}
    </div>
  )
}
