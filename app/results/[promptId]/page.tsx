import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'
import { ChevronLeft, ExternalLink, MapPin, Building2, Tag, Heart } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getPromptData(promptId: string) {
  return prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      batch: true,
      results: {
        include: { citations: true },
        orderBy: { platform: 'asc' },
      },
    },
  })
}

const PLATFORM_ORDER = ['chatgpt', 'claude', 'perplexity', 'gemini', 'google_aio', 'google_ai_mode']

export default async function ResultsDetailPage({
  params,
}: {
  params: Promise<{ promptId: string }>
}) {
  const { promptId } = await params
  let prompt: Awaited<ReturnType<typeof getPromptData>> = null
  try { prompt = await getPromptData(promptId) } catch { /* DB not configured */ }
  if (!prompt) notFound()

  const sortedResults = [...prompt.results].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[#177e89] hover:text-[#084c61] font-medium transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-[#b8cdd3]">/</span>
        <span className="text-sm text-[#5a7a85]">Prompt Results</span>
      </div>

      {/* Prompt metadata card */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <p className="text-base font-medium text-[#1a1a1a] leading-relaxed flex-1">{prompt.promptText}</p>
          <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'} className="flex-shrink-0">
            {prompt.promptType}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#eef3f5]">
          <MetaItem icon={<Building2 className="h-4 w-4 text-[#8aadb8]" />} label="Community" value={prompt.communityName} />
          <MetaItem icon={<MapPin className="h-4 w-4 text-[#8aadb8]" />} label="City / Market" value={prompt.city + (prompt.market ? ` · ${prompt.market}` : '')} />
          <MetaItem icon={<Tag className="h-4 w-4 text-[#8aadb8]" />} label="Category" value={prompt.category} />
          <MetaItem icon={<Heart className="h-4 w-4 text-[#8aadb8]" />} label="Level of Care" value={prompt.levelOfCare} />
        </div>
      </div>

      {/* Platform results */}
      {sortedResults.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#dde6ea] py-16 text-center">
          <p className="text-[#8aadb8] mb-3">No results yet for this prompt.</p>
          <Link href="/run" className="text-sm font-semibold text-[#177e89] hover:text-[#084c61] transition-colors">
            Run prompts →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedResults.map((result) => {
            const color = PLATFORM_COLORS[result.platform] || '#084c61'
            const label = PLATFORM_LABELS[result.platform] || result.platform
            return (
              <div key={result.id} className="bg-white rounded-xl border border-[#dde6ea] flex flex-col overflow-hidden">
                {/* Platform header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef3f5]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-semibold text-[#084c61] text-sm">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {result.isMentioned ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Mentioned
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f0f4f7] text-[#8aadb8]">
                        Not Mentioned
                      </span>
                    )}
                    {result.isCited && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e6f2f5] text-[#084c61] border border-[#b8d8e0]">
                        Cited
                      </span>
                    )}
                  </div>
                </div>

                {/* Response text */}
                <div className="px-5 py-4 flex-1">
                  <p className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-2">Response</p>
                  <p className="text-xs text-[#1a1a1a] leading-relaxed">{result.responseText}</p>
                </div>

                {/* Citations */}
                {result.citations.length > 0 && (
                  <div className="px-5 pb-4 border-t border-[#eef3f5] pt-3">
                    <p className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-2">
                      Citations ({result.citations.length})
                    </p>
                    <div className="space-y-1.5">
                      {result.citations.map((citation) => (
                        <a
                          key={citation.id}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 p-2 rounded-lg bg-[#f5f8fa] hover:bg-[#e6f2f5] transition-colors group"
                        >
                          <ExternalLink className="h-3 w-3 text-[#8aadb8] mt-0.5 flex-shrink-0 group-hover:text-[#177e89] transition-colors" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#084c61] truncate">{citation.title}</p>
                            <p className="text-[10px] text-[#8aadb8]">{citation.domain}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <p className="text-[10px] text-[#8aadb8] uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm font-medium text-[#084c61]">{value || '—'}</p>
      </div>
    </div>
  )
}
