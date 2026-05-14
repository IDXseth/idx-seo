'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'

export interface TrendPoint {
  runSessionId: string
  startedAt: string
  triggeredBy: string
  total: number
  mentionRate: number
  citationRate: number
  positiveRate: number
  negativeRate: number
  byPlatform: Record<string, { mentionRate: number; citationRate: number }>
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`
}

const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #dde6ea',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
}

interface Props {
  data: TrendPoint[]
}

export function TrendCharts({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="py-16 text-center text-[#8aadb8] text-sm">
        Run prompts at least twice to see trends over time.
      </div>
    )
  }

  const PLATFORMS = Object.keys(PLATFORM_LABELS)

  // Overall mention + citation over time
  const overallData = data.map((d) => ({
    date: formatDate(d.startedAt),
    'Mention Rate': Math.round(d.mentionRate * 100),
    'Citation Rate': Math.round(d.citationRate * 100),
  }))

  // Per-platform mention rate over time
  const mentionByPlatformData = data.map((d) => {
    const row: Record<string, string | number> = { date: formatDate(d.startedAt) }
    for (const p of PLATFORMS) {
      row[PLATFORM_LABELS[p] || p] = Math.round((d.byPlatform[p]?.mentionRate ?? 0) * 100)
    }
    return row
  })

  // Per-platform citation rate over time
  const citationByPlatformData = data.map((d) => {
    const row: Record<string, string | number> = { date: formatDate(d.startedAt) }
    for (const p of PLATFORMS) {
      row[PLATFORM_LABELS[p] || p] = Math.round((d.byPlatform[p]?.citationRate ?? 0) * 100)
    }
    return row
  })

  // Sentiment over time
  const sentimentData = data.map((d) => ({
    date: formatDate(d.startedAt),
    Positive: Math.round(d.positiveRate * 100),
    Neutral: Math.round((1 - d.positiveRate - d.negativeRate) * 100),
    Negative: Math.round(d.negativeRate * 100),
  }))

  const legendStyle = { fontSize: 11, paddingTop: 12 }

  return (
    <div className="space-y-8">
      {/* Overall mention + citation */}
      <ChartCard title="Mention & Citation Rate Over Time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={overallData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde6ea" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
            <Line type="monotone" dataKey="Mention Rate" stroke="#084c61" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="Citation Rate" stroke="#177e89" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Mention rate by platform */}
      <ChartCard title="Mention Rate by Platform Over Time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={mentionByPlatformData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde6ea" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
            {PLATFORMS.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={PLATFORM_LABELS[p] || p}
                stroke={PLATFORM_COLORS[p] || '#8aadb8'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Citation rate by platform */}
      <ChartCard title="Citation Rate by Platform Over Time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={citationByPlatformData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde6ea" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
            {PLATFORMS.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={PLATFORM_LABELS[p] || p}
                stroke={PLATFORM_COLORS[p] || '#8aadb8'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Sentiment distribution */}
      <ChartCard title="Sentiment Distribution Over Time">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={sentimentData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#dde6ea" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
            <Bar dataKey="Positive" stackId="s" fill="#059669" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Neutral" stackId="s" fill="#8aadb8" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Negative" stackId="s" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
      <h2 className="text-sm font-semibold text-[#084c61] mb-4">{title}</h2>
      {children}
    </div>
  )
}
