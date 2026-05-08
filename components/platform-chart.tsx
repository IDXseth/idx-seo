'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'

interface PlatformStat {
  platform: string
  mentionRate: number
  citationRate: number
}

interface PlatformChartProps {
  data: PlatformStat[]
  title?: string
}

export function PlatformMentionChart({ data, title }: PlatformChartProps) {
  const chartData = data.map((d) => ({
    name: PLATFORM_LABELS[d.platform] || d.platform,
    'Mention Rate': Math.round(d.mentionRate * 100),
    'Citation Rate': Math.round(d.citationRate * 100),
    color: PLATFORM_COLORS[d.platform] || '#6366F1',
  }))

  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, '']}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
          <Bar dataKey="Mention Rate" fill="#6366F1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Citation Rate" fill="#10B981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
