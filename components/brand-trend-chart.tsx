'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatPercent } from '@/lib/utils'
import type { BrandTrendSeries } from '@/lib/competitor-stats'
import { brandColorMap } from '@/lib/brand-palette'

type Metric = 'mention' | 'citation'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

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
          <span style={{ display: 'inline-block', width: 10, height: 2, background: p.stroke, flexShrink: 0 }} />
          <span style={{ color: '#5a7a85' }}>{p.dataKey}:</span>
          <strong style={{ color: '#084c61' }}>{p.value}%</strong>
        </p>
      ))}
    </div>
  )
}

export function BrandTrendChart({ brands }: { brands: BrandTrendSeries[] }) {
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set(brands.map((b) => b.id)))
  const [metric, setMetric] = useState<Metric>('mention')

  const colorOf = useMemo(() => {
    const map = brandColorMap(brands.map((b) => b.id))
    return (id: string) => map.get(id) ?? '#8aadb8'
  }, [brands])

  const toggle = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const latestRateOf = (b: BrandTrendSeries) => {
    const pt = b.points[b.points.length - 1]
    if (!pt) return 0
    return metric === 'mention' ? pt.mentionRate : pt.citationRate
  }

  const visibleBrands = brands.filter((b) => activeIds.has(b.id))
  const chartData = useMemo(() => {
    const base = brands[0]?.points ?? []
    return base.map((pt, i) => {
      const row: Record<string, string | number> = { date: formatDate(pt.startedAt) }
      for (const b of visibleBrands) {
        const p = b.points[i]
        row[b.label] = p ? Math.round((metric === 'mention' ? p.mentionRate : p.citationRate) * 100) : 0
      }
      return row
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, activeIds, metric])

  if ((brands[0]?.points.length ?? 0) < 2) {
    return <div className="py-16 text-center text-[#8aadb8] text-sm">Run prompts at least twice to see trends over time.</div>
  }

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
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: on ? colorOf(b.id) : '#dde6ea' }} />
                {b.label}
                {b.id === 'you' && <span className="text-[9px] font-bold text-[#177e89]">YOU</span>}
                <span className={on ? 'text-[#5a7a85]' : 'text-[#c5d3d8]'}>{formatPercent(latestRateOf(b))}</span>
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

      {visibleBrands.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#8aadb8]">Select at least one brand above to see the chart.</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef3f5" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />
            {visibleBrands.map((b) => (
              <Line
                key={b.id}
                type="monotone"
                dataKey={b.label}
                stroke={colorOf(b.id)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
