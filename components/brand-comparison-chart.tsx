'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_LABELS, formatPercent } from '@/lib/utils'
import type { BrandSeries } from '@/lib/competitor-stats'

// Validated categorical palette (dataviz skill default order) — "Your Brand"
// always takes slot 1, competitors take the next slots in stable order.
// Fixed per-brand assignment (never re-indexed by which brands are toggled
// on) so a brand keeps its color no matter what else is shown or hidden.
const BRAND_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

type Metric = 'mention' | 'citation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        fontSize: 12,
        borderRadius: 8,
        border: '1px solid #dde6ea',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        background: '#fff',
        padding: '10px 14px',
        minWidth: 160,
      }}
    >
      <p style={{ fontWeight: 600, color: '#084c61', marginBottom: 6 }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 10, height: 2, background: p.fill, flexShrink: 0 }} />
          <span style={{ color: '#5a7a85' }}>{p.dataKey}:</span>
          <strong style={{ color: '#084c61' }}>{p.value}%</strong>
        </p>
      ))}
    </div>
  )
}

export function BrandComparisonChart({ brands, anyBrand }: { brands: BrandSeries[]; anyBrand: BrandSeries }) {
  const router = useRouter()
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set(brands.map((b) => b.id)))
  const [metric, setMetric] = useState<Metric>('mention')

  const colorOf = useMemo(() => {
    const map = new Map(brands.map((b, i) => [b.id, BRAND_PALETTE[i % BRAND_PALETTE.length]]))
    return (id: string) => map.get(id) ?? '#8aadb8'
  }, [brands])

  const rateOf = (b: BrandSeries) => (metric === 'mention' ? b.overallMentionRate : b.overallCitationRate)
  const platformRateOf = (b: BrandSeries, platform: string) => {
    const stat = b.platformStats.find((s) => s.platform === platform)
    if (!stat) return 0
    return metric === 'mention' ? stat.mentionRate : stat.citationRate
  }

  const toggle = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleBrands = brands.filter((b) => activeIds.has(b.id))
  // Fixed X-axis categories (platforms) with one column per visible brand.
  const chartData = useMemo(() => {
    const platforms = brands[0]?.platformStats.map((s) => s.platform) ?? []
    return platforms.map((platform) => {
      const row: Record<string, string | number> = { name: PLATFORM_LABELS[platform] || platform, platform }
      for (const b of visibleBrands) {
        row[b.label] = Math.round(platformRateOf(b, platform) * 100)
      }
      return row
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, activeIds, metric])

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex flex-wrap gap-1.5">
          {brands.map((b) => {
            const on = activeIds.has(b.id)
            return (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  on ? 'bg-white border-[#dde6ea] text-[#084c61]' : 'bg-[#f5f8fa] border-[#eef3f5] text-[#b8cdd3]'
                }`}
                title={on ? `Hide ${b.label}` : `Show ${b.label}`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ background: on ? colorOf(b.id) : '#dde6ea' }}
                />
                {b.label}
                {b.id === 'you' && <span className="text-[9px] font-bold text-[#177e89]">YOU</span>}
                <span className={on ? 'text-[#5a7a85]' : 'text-[#c5d3d8]'}>{formatPercent(rateOf(b))}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-0.5 bg-[#f0f4f7] rounded-lg p-1 flex-shrink-0">
          {(['mention', 'citation'] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                metric === m ? 'bg-white text-[#084c61] shadow-sm' : 'text-[#5a7a85] hover:text-[#084c61]'
              }`}
            >
              {m === 'mention' ? 'Mention Rate' : 'Citation Rate'}
            </button>
          ))}
        </div>
      </div>

      {/* Always-on aggregate — reflects every tracked brand regardless of which are toggled visible above */}
      <div className="flex items-center gap-4 bg-[#fff8e8] border border-[#f3e3b8] rounded-lg px-4 py-3 mb-4">
        <span className="text-xs font-semibold text-[#8a6d1f] uppercase tracking-wide flex-shrink-0">Any tracked brand</span>
        <span className="text-xs text-[#5a7a85]">
          Mentioned <strong className="text-[#084c61]">{formatPercent(anyBrand.overallMentionRate)}</strong> of responses
        </span>
        <span className="text-xs text-[#5a7a85]">
          Cited <strong className="text-[#084c61]">{formatPercent(anyBrand.overallCitationRate)}</strong> of responses
        </span>
      </div>

      {visibleBrands.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#8aadb8]">Select at least one brand above to see the chart.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 64 }}
            barGap={2}
            barCategoryGap="24%"
            style={{ cursor: 'pointer' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload[0]) {
                const platform = e.activePayload[0].payload.platform
                if (platform) router.push('/dashboard/platform/' + platform)
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#dde6ea" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#5a7a85' }}
              angle={-30}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#8aadb8' }}
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0f4f7' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} iconType="circle" iconSize={8} />
            {visibleBrands.map((b) => (
              <Bar key={b.id} dataKey={b.label} fill={colorOf(b.id)} radius={[4, 4, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
