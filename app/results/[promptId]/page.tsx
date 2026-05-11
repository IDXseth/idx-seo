import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { PLATFORM_LABELS, PLATFORM_COLORS, cn } from '@/lib/utils'
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
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500">Prompt Results</span>
      </div>

      {/* Prompt metadata card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <p className="text-base font-medium text-slate-900 leading-relaxed flex-1">{prompt.promptText}</p>
          <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'} className="flex-shrink-0">
            {prompt.promptType}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <MetaItem icon={<Building2 className="h-4 w-4 text-slate-400" />} label="Community" value={prompt.communityName} />
          <MetaItem icon={<MapPin className="h-4 w-4 text-slate-400" />} label="City / Market" value={prompt.city + (prompt.market ? ` · ${prompt.market}` : '')} />
          <MetaItem icon={<Tag className="h-4 w-4 text-slate-400" />} label="Category" value={prompt.category} />
          <MetaItem icon={<Heart className="h-4 w-4 text-slate-400" />} label="Level of Care" value={prompt.levelOfCare} />
        </div>
      </div>

      {/* Platform results */}
      {sortedResults.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <p className="text-slate-400 mb-3">No results yet for this prompt.</p>
          <Link href="/run" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Run prompts →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedResults.map((result) => {
            const color = PLATFORM_COLORS[result.platform] || '#6366F1'
            const label = PLATFORM_LABELS[result.platform] || result.platform
            return (
              <div key={result.id} className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                {/* Platform header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-semibold text-slate-800 text-sm">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {result.isMentioned ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Mentioned
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                        Not Mentioned
                      </span>
                    )}
                    {result.isCited && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Cited
                      </span>
                    )}
                  </div>
                </div>

                {/* Response text */}
                <div className="px-5 py-4 flex-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Response</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{result.responseText}</p>
                </div>

                {/* Citations */}
                {result.citations.length > 0 && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Citations ({result.citations.length})
                    </p>
                    <div className="space-y-1.5">
                      {result.citations.map((citation) => (
                        <a
                          key={citation.id}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 transition-colors group"
                        >
                          <ExternalLink className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0 group-hover:text-indigo-500 transition-colors" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">{citation.title}</p>
                            <p className="text-[10px] text-slate-400">{citation.domain}</p>
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
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
      </div>
    </div>
  )
}
