import Link from 'next/link'
import { cn, formatPercent } from '@/lib/utils'
import { MapPin, ChevronRight } from 'lucide-react'

interface ScorecardProps {
  title: string
  subtitle?: string
  mentionRate: number
  citationRate: number
  promptCount: number
  href?: string
}

function rateColor(rate: number) {
  if (rate >= 0.6) return { text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'High', labelCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (rate >= 0.3) return { text: 'text-amber-600', bar: 'bg-amber-400', label: 'Medium', labelCls: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { text: 'text-rose-600', bar: 'bg-rose-400', label: 'Low', labelCls: 'bg-rose-50 text-rose-700 border-rose-200' }
}

export function Scorecard({ title, subtitle, mentionRate, citationRate, promptCount, href }: ScorecardProps) {
  const mc = rateColor(mentionRate)
  const cc = rateColor(citationRate)

  const inner = (
    <div className={cn(
      'bg-white rounded-xl border border-[#dde6ea] p-5 flex flex-col gap-4 transition-all',
      href && 'hover:shadow-md hover:border-[#177e89] cursor-pointer group'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#084c61] leading-snug truncate" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>{title}</h3>
          {subtitle && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-[#8aadb8] flex-shrink-0" />
              <p className="text-xs text-[#5a7a85] truncate">{subtitle}</p>
            </div>
          )}
        </div>
        {href && (
          <ChevronRight className="h-4 w-4 text-[#b8cdd3] group-hover:text-[#177e89] flex-shrink-0 mt-0.5 transition-colors" />
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        <Metric
          label="Mention Rate"
          value={mentionRate}
          barColor={mc.bar}
          textColor={mc.text}
          labelCls={mc.labelCls}
          performanceLabel={mc.label}
        />
        <Metric
          label="Citation Rate"
          value={citationRate}
          barColor={cc.bar}
          textColor={cc.text}
          labelCls={cc.labelCls}
          performanceLabel={cc.label}
        />
      </div>

      {/* Footer */}
      <p className="text-xs text-[#8aadb8] pt-1 border-t border-[#eef3f5]">
        {promptCount} prompt{promptCount !== 1 ? 's' : ''} analyzed
      </p>
    </div>
  )

  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function Metric({
  label,
  value,
  barColor,
  textColor,
  labelCls,
  performanceLabel,
}: {
  label: string
  value: number
  barColor: string
  textColor: string
  labelCls: string
  performanceLabel: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[#5a7a85]">{label}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', textColor)}>{formatPercent(value)}</span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', labelCls)}>
            {performanceLabel}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[#eef3f5] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  )
}
