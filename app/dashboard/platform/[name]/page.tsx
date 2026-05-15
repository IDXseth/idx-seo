import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'
import { ChevronLeft, Target, Quote, Smile } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformDrillDownPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ session?: string }>
}) {
  const { name } = await params
  const { session: sessionId } = await searchParams

  if (!PLATFORM_LABELS[name]) {
    notFound()
  }

  const platformLabel = PLATFORM_LABELS[name]
  const platformColor = PLATFORM_COLORS[name] || '#084c61'
  const backHref = `/dashboard${sessionId ? '?session=' + sessionId : ''}`

  let results: Array<{
    id: string
    isMentioned: boolean
    isCited: boolean
    sentiment: string
    prompt: {
      id: string
      promptText: string
      communityName: string
      category: string
      levelOfCare: string
      city: string
    }
    citations: Array<{ id: string }>
  }> = []

  try {
    results = await prisma.result.findMany({
      where: {
        platform: name,
        ...(sessionId ? { runSessionId: sessionId } : {}),
      },
      include: {
        prompt: {
          select: {
            id: true,
            promptText: true,
            communityName: true,
            category: true,
            levelOfCare: true,
            city: true,
          },
        },
        citations: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    // DB not configured
  }

  const totalResults = results.length
  const mentionedCount = results.filter((r) => r.isMentioned).length
  const citedCount = results.filter((r) => r.isCited).length
  const mentionRate = totalResults > 0 ? mentionedCount / totalResults : 0
  const citationRate = totalResults > 0 ? citedCount / totalResults : 0

  const positiveCount = results.filter((r) => r.sentiment === 'positive').length
  const neutralCount = results.filter((r) => r.sentiment === 'neutral').length
  const negativeCount = results.filter((r) => r.sentiment === 'negative').length
  const positiveRate = totalResults > 0 ? positiveCount / totalResults : 0

  const sentimentColor =
    positiveRate >= 0.6 ? 'text-emerald-600' : positiveRate >= 0.3 ? 'text-amber-600' : 'text-rose-500'
  const sentimentLabel = `${Math.round(positiveRate * 100)}% positive`

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-[#177e89] hover:text-[#084c61] font-medium transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-[#b8cdd3]">/</span>
        <span className="text-sm text-[#5a7a85]">{platformLabel}</span>
      </div>

      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: platformColor }} />
        <h1
          className="text-2xl font-bold text-[#084c61]"
          style={{ fontFamily: 'var(--font-noto-serif), serif' }}
        >
          {platformLabel}
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-xs font-medium text-[#5a7a85]">Mention Rate</p>
          </div>
          <p className="text-3xl font-bold text-[#084c61] leading-none">
            {Math.round(mentionRate * 100)}%
          </p>
          <p className="text-xs text-[#8aadb8] mt-1">
            {mentionedCount} of {totalResults} results
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#e6f2f5]">
              <Quote className="h-5 w-5 text-[#177e89]" />
            </div>
            <p className="text-xs font-medium text-[#5a7a85]">Citation Rate</p>
          </div>
          <p className="text-3xl font-bold text-[#084c61] leading-none">
            {Math.round(citationRate * 100)}%
          </p>
          <p className="text-xs text-[#8aadb8] mt-1">
            {citedCount} of {totalResults} results
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#e6f2f5]">
              <Smile className="h-5 w-5 text-[#084c61]" />
            </div>
            <p className="text-xs font-medium text-[#5a7a85]">Sentiment</p>
          </div>
          <p className={`text-3xl font-bold leading-none ${sentimentColor}`}>
            {sentimentLabel}
          </p>
          <p className="text-xs text-[#8aadb8] mt-1">
            {positiveCount}+ / {neutralCount}~ / {negativeCount}-
          </p>
        </div>
      </div>

      {/* Prompts table */}
      <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eef3f5]">
          <h2 className="text-sm font-semibold text-[#084c61]">All Prompts</h2>
        </div>
        {results.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#8aadb8] text-sm">No results for this platform yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eef3f5] bg-[#f5f8fa]">
                  <th className="text-left px-6 py-3 font-medium text-[#5a7a85] text-xs min-w-[200px]">Prompt</th>
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Community</th>
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Level of Care</th>
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Mentioned</th>
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Cited</th>
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Sentiment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f7]">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-[#f5f8fa] transition-colors">
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 text-[#1a1a1a] text-xs leading-relaxed">
                        {result.prompt.promptText}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[#084c61] text-xs font-medium">{result.prompt.communityName || '—'}</p>
                      {result.prompt.city && (
                        <p className="text-[#8aadb8] text-[10px] mt-0.5">{result.prompt.city}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[#5a7a85] text-xs">{result.prompt.category || '—'}</td>
                    <td className="px-4 py-4 text-[#5a7a85] text-xs">{result.prompt.levelOfCare || '—'}</td>
                    <td className="px-4 py-4">
                      {result.isMentioned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Mentioned
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f0f4f7] text-[#8aadb8]">
                          Not Mentioned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {result.isCited ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e6f2f5] text-[#177e89] border border-[#b8d8e0]">
                          Cited
                        </span>
                      ) : (
                        <span className="text-[#b8cdd3] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {result.sentiment === 'positive' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Positive
                        </span>
                      ) : result.sentiment === 'negative' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Negative
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f0f4f7] text-[#8aadb8]">
                          Neutral
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
