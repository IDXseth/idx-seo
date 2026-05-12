import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PLATFORMS, PLATFORM_LABELS, formatPercent } from '@/lib/utils'
import { BarChart3, Target, Quote, Layers } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

async function getSharedBatchData(token: string) {
  const batch = await prisma.batch.findUnique({
    where: { shareToken: token },
    include: {
      prompts: {
        include: {
          results: {
            include: { citations: true },
          },
        },
      },
    },
  })

  return batch
}

export default async function SharedBatchPage({ params }: Props) {
  const { token } = await params
  const batch = await getSharedBatchData(token)

  if (!batch) {
    notFound()
  }

  // Compute stats
  const allResults = batch.prompts.flatMap((p) => p.results)
  const totalResults = allResults.length
  const mentionedCount = allResults.filter((r) => r.isMentioned).length
  const citedCount = allResults.filter((r) => r.isCited).length

  const overallMentionRate = totalResults > 0 ? mentionedCount / totalResults : 0
  const overallCitationRate = totalResults > 0 ? citedCount / totalResults : 0

  const platformStats = PLATFORMS.map((platform) => {
    const platformResults = allResults.filter((r) => r.platform === platform)
    const total = platformResults.length
    const mentioned = platformResults.filter((r) => r.isMentioned).length
    const cited = platformResults.filter((r) => r.isCited).length
    return {
      platform,
      total,
      mentioned,
      cited,
      mentionRate: total > 0 ? mentioned / total : 0,
      citationRate: total > 0 ? cited / total : 0,
    }
  }).filter((s) => s.total > 0)

  // Community breakdown
  const communityMap = new Map<string, { mentioned: number; cited: number; total: number }>()
  for (const prompt of batch.prompts) {
    const key = prompt.communityName
    const entry = communityMap.get(key) ?? { mentioned: 0, cited: 0, total: 0 }
    for (const result of prompt.results) {
      entry.total++
      if (result.isMentioned) entry.mentioned++
      if (result.isCited) entry.cited++
    }
    communityMap.set(key, entry)
  }

  return (
    <div className="min-h-screen bg-[#f0f4f7]">
      {/* Simple header */}
      <div style={{ background: 'linear-gradient(90deg, #084c61 0%, #054166 100%)' }} className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/15">
              <span className="text-white font-bold text-sm tracking-tight select-none">SL</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
                Senior Lifestyle
              </p>
              <p className="text-[11px] text-white/65 leading-none mt-0.5 font-medium tracking-wide">
                AI Visibility Dashboard
              </p>
            </div>
          </div>
          <span className="text-xs text-white/60 bg-white/10 px-3 py-1.5 rounded-full">Read-only shared view</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Batch name + meta */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
            {batch.name}
          </h1>
          <p className="text-[#5a7a85] mt-1 text-sm">
            {batch.prompts.length} prompts &bull; Shared on {new Date(batch.createdAt).toLocaleDateString()}
          </p>
        </div>

        {totalResults === 0 ? (
          <div className="bg-white rounded-xl border border-[#dde6ea] py-16 text-center">
            <BarChart3 className="h-12 w-12 text-[#b8cdd3] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#084c61] mb-2">No results yet</h3>
            <p className="text-[#5a7a85] text-sm">This project hasn&apos;t been run against AI platforms yet.</p>
          </div>
        ) : (
          <>
            {/* Stat strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<BarChart3 className="h-5 w-5 text-[#084c61]" />}
                iconBg="bg-[#e6f2f5]"
                label="Prompts Analyzed"
                value={batch.prompts.length.toLocaleString()}
              />
              <StatCard
                icon={<Target className="h-5 w-5 text-emerald-600" />}
                iconBg="bg-emerald-50"
                label="Overall Mention Rate"
                value={formatPercent(overallMentionRate)}
              />
              <StatCard
                icon={<Quote className="h-5 w-5 text-[#177e89]" />}
                iconBg="bg-[#e6f2f5]"
                label="Overall Citation Rate"
                value={formatPercent(overallCitationRate)}
              />
              <StatCard
                icon={<Layers className="h-5 w-5 text-[#084c61]" />}
                iconBg="bg-[#e6f2f5]"
                label="Platforms"
                value={String(platformStats.length)}
              />
            </div>

            {/* Platform breakdown */}
            <div className="bg-white rounded-xl border border-[#dde6ea] p-6 mb-6">
              <h2 className="text-sm font-semibold text-[#084c61] mb-4">Performance by Platform</h2>
              <div className="space-y-3">
                {platformStats.map((ps) => (
                  <div key={ps.platform} className="flex items-center gap-4">
                    <span className="text-xs font-medium text-[#084c61] w-32 shrink-0">
                      {PLATFORM_LABELS[ps.platform] ?? ps.platform}
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#8aadb8]">Mention</span>
                          <span className="text-[10px] font-medium text-[#084c61]">{formatPercent(ps.mentionRate)}</span>
                        </div>
                        <div className="h-1.5 bg-[#f0f4f7] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#177e89] rounded-full"
                            style={{ width: `${ps.mentionRate * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#8aadb8]">Citation</span>
                          <span className="text-[10px] font-medium text-[#084c61]">{formatPercent(ps.citationRate)}</span>
                        </div>
                        <div className="h-1.5 bg-[#f0f4f7] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#084c61] rounded-full"
                            style={{ width: `${ps.citationRate * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Community breakdown */}
            {communityMap.size > 0 && (
              <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
                <h2 className="text-sm font-semibold text-[#084c61] mb-4">Performance by Community</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from(communityMap.entries()).map(([name, stats]) => (
                    <div key={name} className="p-4 rounded-xl border border-[#dde6ea]">
                      <h3 className="font-semibold text-[#084c61] text-sm mb-3 truncate">{name}</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-[#f5f8fa] rounded-lg">
                          <p className="text-lg font-bold text-[#177e89]">
                            {formatPercent(stats.total > 0 ? stats.mentioned / stats.total : 0)}
                          </p>
                          <p className="text-[10px] text-[#8aadb8]">Mention</p>
                        </div>
                        <div className="text-center p-2 bg-[#f5f8fa] rounded-lg">
                          <p className="text-lg font-bold text-[#084c61]">
                            {formatPercent(stats.total > 0 ? stats.cited / stats.total : 0)}
                          </p>
                          <p className="text-[10px] text-[#8aadb8]">Citation</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-[#8aadb8]">
            Powered by{' '}
            <Link href="/" className="text-[#177e89] hover:underline">
              Senior Lifestyle AI Visibility Dashboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <p className="text-xs font-medium text-[#5a7a85]">{label}</p>
      </div>
      <p className="text-3xl font-bold text-[#084c61] leading-none">{value}</p>
    </div>
  )
}
