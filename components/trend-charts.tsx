'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
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

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #dde6ea',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
}

const legendStyle = { fontSize: 11, paddingTop: 12 }

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
  const latest = data[data.length - 1]
  const prev = data[data.length - 2]

  const overallData = data.map((d) => ({
    date: formatDate(d.startedAt),
    'Mention Rate': Math.round(d.mentionRate * 100),
    'Citation Rate': Math.round(d.citationRate * 100),
  }))

  const sentimentData = data.map((d) => ({
    date: formatDate(d.startedAt),
    Positive: Math.round(d.positiveRate * 100),
    Neutral: Math.round((1 - d.positiveRate - d.negativeRate) * 100),
    Negative: Math.round(d.negativeRate * 100),
  }))

  const mentionByPlatformData = data.map((d) => {
    const row: Record<string, string | number> = { date: formatDate(d.startedAt) }
    for (const p of PLATFORMS) row[PLATFORM_LABELS[p] || p] = Math.round((d.byPlatform[p]?.mentionRate ?? 0) * 100)
    return row
  })

  const citationByPlatformData = data.map((d) => {
    const row: Record<string, string | number> = { date: formatDate(d.startedAt) }
    for (const p of PLATFORMS) row[PLATFORM_LABELS[p] || p] = Math.round((d.byPlatform[p]?.citationRate ?? 0) * 100)
    return row
  })

  return (
    <div className="space-y-6">
      {/* Stat cards — most recent session vs previous */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Mention Rate"
          value={`${Math.round(latest.mentionRate * 100)}%`}
          change={Math.round((latest.mentionRate - prev.mentionRate) * 100)}
          unit="%"
          spark={data.map((d) => ({ v: Math.round(d.mentionRate * 100) }))}
          color="#084c61"
        />
        <StatCard
          label="Citation Rate"
          value={`${Math.round(latest.citationRate * 100)}%`}
          change={Math.round((latest.citationRate - prev.citationRate) * 100)}
          unit="%"
          spark={data.map((d) => ({ v: Math.round(d.citationRate * 100) }))}
          color="#177e89"
        />
        <StatCard
          label="Positive Sentiment"
          value={`${Math.round(latest.positiveRate * 100)}%`}
          change={Math.round((latest.positiveRate - prev.positiveRate) * 100)}
          unit="%"
          spark={data.map((d) => ({ v: Math.round(d.positiveRate * 100) }))}
          color="#059669"
        />
        <StatCard
          label="Responses"
          value={latest.total.toLocaleString()}
          change={latest.total - prev.total}
          unit=""
          spark={data.map((d) => ({ v: d.total }))}
          color="#177e89"
        />
      </div>

      {/* 2×2 chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Mention & Citation Rate Trend" subtitle="Overall brand mention and domain citation rates over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={overallData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef3f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
              <Line type="monotone" dataKey="Mention Rate" stroke="#084c61" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Citation Rate" stroke="#177e89" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sentiment Trend" subtitle="Sentiment distribution changes over time">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={sentimentData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef3f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="Positive" stackId="s" stroke="#059669" fill="#059669" fillOpacity={0.85} />
              <Area type="monotone" dataKey="Neutral" stackId="s" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.85} />
              <Area type="monotone" dataKey="Negative" stackId="s" stroke="#ef4444" fill="#ef4444" fillOpacity={0.85} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Mention Rate by LLM" subtitle="How each AI platform mentions your brand over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={mentionByPlatformData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef3f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
              {PLATFORMS.map((p) => (
                <Line key={p} type="monotone" dataKey={PLATFORM_LABELS[p] || p}
                  stroke={PLATFORM_COLORS[p] || '#8aadb8'} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Citation Rate by LLM" subtitle="How each AI platform cites your domain over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={citationByPlatformData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef3f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a7a85' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8aadb8' }} domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [pct(Number(v) / 100), n]} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
              {PLATFORMS.map((p) => (
                <Line key={p} type="monotone" dataKey={PLATFORM_LABELS[p] || p}
                  stroke={PLATFORM_COLORS[p] || '#8aadb8'} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function StatCard({
  label, value, change, unit, spark, color,
}: {
  label: string
  value: string
  change: number
  unit: string
  spark: { v: number }[]
  color: string
}) {
  const up = change > 0
  const flat = change === 0
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
      <p className="text-xs font-medium text-[#5a7a85] mb-2">{label}</p>
      <p className="text-3xl font-bold text-[#084c61] leading-none">{value}</p>
      <p className={`text-xs font-medium mt-1 mb-3 ${flat ? 'text-[#8aadb8]' : up ? 'text-emerald-600' : 'text-rose-500'}`}>
        {flat ? '— No change' : `${up ? '↑' : '↓'} ${up ? '+' : ''}${change}${unit} vs previous`}
      </p>
      <ResponsiveContainer width="100%" height={40}>
        <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.08}
            strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[#084c61]">{title}</h2>
        {subtitle && <p className="text-xs text-[#8aadb8] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
