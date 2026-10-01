import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { promptScope, getSegmentLabels } from '@/lib/projects'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'
import { PromptTypeToggle, PromptTypeFilter } from '@/components/prompt-type-toggle'
import { SentimentBreakdown } from '@/components/sentiment-breakdown'
import { ChevronLeft, Target, Quote, Smile } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformDrillDownPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ session?: string; type?: string }>
}) {
  const { name } = await params
  const { session: sessionId, type } = await searchParams
  const promptTypeParam: PromptTypeFilter = type === 'brand' || type === 'nonbrand' ? type : 'all'
  const promptType = promptTypeParam === 'all' ? undefined : promptTypeParam

  if (!PLATFORM_LABELS[name]) {
    notFound()
  }

  const platformLabel = PLATFORM_LABELS[name]
  const labels = await getSegmentLabels()
  const platformColor = PLATFORM_COLORS[name] || 'var(--c-ink)'
  const dashboardQuery = new URLSearchParams()
  if (sessionId) dashboardQuery.set('session', sessionId)
  if (promptType) dashboardQuery.set('type', promptType)
  const backHref = `/dashboard${dashboardQuery.toString() ? `?${dashboardQuery.toString()}` : ''}`

  let results: Array<{
    id: string
    responseText: string
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
        prompt: { ...(await promptScope()), ...(promptType ? { promptType } : {}) },
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
      orderBy: { runAt: 'desc' },
    })
  } catch {
    // DB not configured
  }

  const totalResults = results.length
  const mentionedCount = results.filter((r) => r.isMentioned).length
  const citedCount = results.filter((r) => r.isCited).length
  const mentionRate = totalResults > 0 ? mentionedCount / totalResults : 0
  const citationRate = totalResults > 0 ? citedCount / totalResults : 0

  // Sentiment only means something on a response that actually mentions the brand.
  const mentionedResults = results.filter((r) => r.isMentioned)
  const positiveCount = mentionedResults.filter((r) => r.sentiment === 'positive').length
  const neutralCount = mentionedResults.filter((r) => r.sentiment === 'neutral').length
  const negativeCount = mentionedResults.filter((r) => r.sentiment === 'negative').length
  const positiveRate = mentionedCount > 0 ? positiveCount / mentionedCount : 0

  const sentimentColor =
    positiveRate >= 0.6 ? 'text-emerald-600' : positiveRate >= 0.3 ? 'text-amber-600' : 'text-rose-500'
  const sentimentLabel = `${Math.round(positiveRate * 100)}% positive`

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-(--c-accent) hover:text-(--c-ink) font-medium transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-(--c-faint)">/</span>
        <span className="text-sm text-(--c-muted)">{platformLabel}</span>
      </div>

      {/* Page title */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: platformColor }} />
          <h1
            className="text-2xl font-bold text-(--c-ink)"
            style={{ fontFamily: 'var(--font-noto-serif), serif' }}
          >
            {platformLabel}
          </h1>
        </div>
        <PromptTypeToggle value={promptTypeParam} basePath={`/dashboard/platform/${name}`} sessionId={sessionId} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-(--c-line) p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-xs font-medium text-(--c-muted)">Mention Rate</p>
          </div>
          <p className="text-3xl font-bold text-(--c-ink) leading-none">
            {Math.round(mentionRate * 100)}%
          </p>
          <p className="text-xs text-(--c-subtle) mt-1">
            {mentionedCount} of {totalResults} results
          </p>
        </div>

        <div className="bg-white rounded-xl border border-(--c-line) p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-(--c-tint)">
              <Quote className="h-5 w-5 text-(--c-accent)" />
            </div>
            <p className="text-xs font-medium text-(--c-muted)">Citation Rate</p>
          </div>
          <p className="text-3xl font-bold text-(--c-ink) leading-none">
            {Math.round(citationRate * 100)}%
          </p>
          <p className="text-xs text-(--c-subtle) mt-1">
            {citedCount} of {totalResults} results
          </p>
        </div>

        <div className="bg-white rounded-xl border border-(--c-line) p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-(--c-tint)">
              <Smile className="h-5 w-5 text-(--c-ink)" />
            </div>
            <p className="text-xs font-medium text-(--c-muted)">Sentiment</p>
          </div>
          <p className={`text-3xl font-bold leading-none ${sentimentColor}`}>
            {sentimentLabel}
          </p>
          <p className="text-xs text-(--c-subtle) mt-1">
            {positiveCount}+ / {neutralCount}~ / {negativeCount}-
          </p>
        </div>
      </div>

      <SentimentBreakdown results={results} />

      {/* Prompts table */}
      <div className="bg-white rounded-xl border border-(--c-line) overflow-hidden">
        <div className="px-6 py-4 border-b border-(--c-line-soft)">
          <h2 className="text-sm font-semibold text-(--c-ink)">All Prompts</h2>
        </div>
        {results.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-(--c-subtle) text-sm">No results for this platform yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--c-line-soft) bg-(--c-surface)">
                  <th className="text-left px-6 py-3 font-medium text-(--c-muted) text-xs min-w-[200px]">Prompt</th>
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">{labels.entity}</th>
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">{labels.levelOfCare}</th>
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Mentioned</th>
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Cited</th>
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Sentiment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--c-page)">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-(--c-surface) transition-colors">
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 text-(--c-text) text-xs leading-relaxed">
                        {result.prompt.promptText}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-(--c-ink) text-xs font-medium">{result.prompt.communityName || '—'}</p>
                      {result.prompt.city && (
                        <p className="text-(--c-subtle) text-[10px] mt-0.5">{result.prompt.city}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-(--c-muted) text-xs">{result.prompt.category || '—'}</td>
                    <td className="px-4 py-4 text-(--c-muted) text-xs">{result.prompt.levelOfCare || '—'}</td>
                    <td className="px-4 py-4">
                      {result.responseText?.startsWith('[No AI Overview]') ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-(--c-page) text-(--c-faint) italic">
                          No AI Overview
                        </span>
                      ) : result.isMentioned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Mentioned
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-(--c-page) text-(--c-subtle)">
                          Not Mentioned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {result.isCited ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-(--c-tint) text-(--c-accent) border border-(--c-accent-faint)">
                          Cited
                        </span>
                      ) : (
                        <span className="text-(--c-faint) text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {!result.isMentioned ? (
                        <span className="text-(--c-faint) text-xs">—</span>
                      ) : result.sentiment === 'positive' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Positive
                        </span>
                      ) : result.sentiment === 'negative' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Negative
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-(--c-page) text-(--c-subtle)">
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
