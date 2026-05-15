'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_LABELS } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface PlatformStat {
  platform: string
  mentionRate: number
  citationRate: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  // Always show Mention Rate first, then Citation Rate
  const mentionEntry = payload.find((p: any) => p.dataKey === 'Mention Rate')
  const citationEntry = payload.find((p: any) => p.dataKey === 'Citation Rate')

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
      {mentionEntry && (
        <p style={{ color: mentionEntry.fill, margin: '2px 0' }}>
          Mention Rate: <strong>{mentionEntry.value}%</strong>
        </p>
      )}
      {citationEntry && (
        <p style={{ color: citationEntry.fill, margin: '2px 0' }}>
          Citation Rate: <strong>{citationEntry.value}%</strong>
        </p>
      )}
      <p style={{ color: '#8aadb8', marginTop: 8, fontSize: 11 }}>Click to drill down →</p>
    </div>
  )
}

export function PlatformMentionChart({ data }: { data: PlatformStat[] }) {
  const router = useRouter()

  const chartData = data.map((d) => ({
    name: PLATFORM_LABELS[d.platform] || d.platform,
    platform: d.platform,
    'Mention Rate': Math.round(d.mentionRate * 100),
    'Citation Rate': Math.round(d.citationRate * 100),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 16, left: 0, bottom: 64 }}
        barCategoryGap="30%"
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
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="Mention Rate" fill="#084c61" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Citation Rate" fill="#177e89" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
