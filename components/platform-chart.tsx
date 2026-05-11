'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_LABELS } from '@/lib/utils'

interface PlatformStat {
  platform: string
  mentionRate: number
  citationRate: number
}

export function PlatformMentionChart({ data }: { data: PlatformStat[] }) {
  const chartData = data.map((d) => ({
    name: PLATFORM_LABELS[d.platform] || d.platform,
    'Mention Rate': Math.round(d.mentionRate * 100),
    'Citation Rate': Math.round(d.citationRate * 100),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 64 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          angle={-30}
          textAnchor="end"
          interval={0}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) => [`${value}%`, name]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="Mention Rate" fill="#4f46e5" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Citation Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
