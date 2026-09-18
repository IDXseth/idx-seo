import { countSentiments } from '@/lib/sentiment'
import { SentimentPieChart } from '@/components/sentiment-pie-chart'

// Presentational card — the surrounding page's ProjectPicker/PromptTypeToggle
// already scope `results` to the selected project and brand/nonbrand filter,
// so this just renders whatever's handed to it.
export function SentimentBreakdown({
  results,
  title = 'Sentiment Breakdown',
}: {
  results: { sentiment: string }[]
  title?: string
}) {
  const counts = countSentiments(results)
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
      <h2 className="text-sm font-semibold text-[#084c61] mb-4">{title}</h2>
      <SentimentPieChart counts={counts} />
    </div>
  )
}
