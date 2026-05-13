import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { formatPercent } from '@/lib/utils'
import { MapPin, TrendingUp, Quote } from 'lucide-react'

interface ScorecardProps {
  title: string
  subtitle?: string
  mentionRate: number
  citationRate: number
  promptCount: number
  href?: string
}

export function Scorecard({ title, subtitle, mentionRate, citationRate, promptCount, href }: ScorecardProps) {
  const card = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardContent className="p-5">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">{title}</h3>
          {subtitle && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-gray-400" />
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">Mentions</span>
            </div>
            <span className={`text-xl font-bold ${getMentionColor(mentionRate)}`}>
              {formatPercent(mentionRate)}
            </span>
          </div>
          <div className="bg-gray-50 rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Quote className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">Citations</span>
            </div>
            <span className="text-xl font-bold text-indigo-600">
              {formatPercent(citationRate)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{promptCount} prompts</span>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${getMentionDot(mentionRate)}`} />
            <span className="text-xs text-gray-500">{getMentionLabel(mentionRate)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{card}</Link>
  }
  return card
}

function getMentionColor(rate: number): string {
  if (rate >= 0.6) return 'text-green-600'
  if (rate >= 0.3) return 'text-yellow-600'
  return 'text-red-600'
}

function getMentionDot(rate: number): string {
  if (rate >= 0.6) return 'bg-green-500'
  if (rate >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getMentionLabel(rate: number): string {
  if (rate >= 0.6) return 'High'
  if (rate >= 0.3) return 'Medium'
  return 'Low'
}
