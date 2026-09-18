'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { SentimentCounts } from '@/lib/sentiment'

const SLICES: { key: keyof Omit<SentimentCounts, 'total'>; label: string; color: string }[] = [
  { key: 'positive', label: 'Positive', color: '#059669' },
  { key: 'neutral', label: 'Neutral', color: '#f59e0b' },
  { key: 'negative', label: 'Negative', color: '#ef4444' },
]

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #dde6ea',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null
  const { name, value, percent } = payload[0]
  return (
    <div style={{ ...tooltipStyle, background: '#fff', padding: '8px 12px' }}>
      <p style={{ fontWeight: 600, color: '#084c61', margin: 0 }}>{name}</p>
      <p style={{ color: '#5a7a85', margin: '2px 0 0' }}>
        {value} · {Math.round(percent * 100)}%
      </p>
    </div>
  )
}

export function SentimentPieChart({ counts }: { counts: SentimentCounts }) {
  if (counts.total === 0) {
    return (
      <div className="py-12 text-center text-[#8aadb8] text-sm">
        No sentiment data for this selection.
      </div>
    )
  }

  const data = SLICES.map((s) => ({ name: s.label, value: counts[s.key], color: s.color }))
    .filter((d) => d.value > 0)

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              cornerRadius={3}
              stroke="#fff"
              strokeWidth={2}
              label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
              labelLine={false}
              // Direct labels use ink text, never the slice's own color.
              style={{ fontSize: 11, fontWeight: 600, fill: '#084c61' }}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ color: '#5a7a85' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total — donut hole doubles as a stat tile */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 32 }}>
          <p className="text-2xl font-bold text-[#084c61] leading-none">{counts.total.toLocaleString()}</p>
          <p className="text-[10px] text-[#8aadb8] uppercase tracking-wide mt-0.5">Responses</p>
        </div>
      </div>
      {/* Accessible text equivalent — counts alongside the legend's color */}
      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        {SLICES.map((s) => (
          <div key={s.key}>
            <p className="text-sm font-semibold text-[#084c61]">{counts[s.key]}</p>
            <p className="text-[10px] text-[#8aadb8]">
              {s.label} · {counts.total > 0 ? Math.round((counts[s.key] / counts.total) * 100) : 0}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
