import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'
import { ChevronLeft, ExternalLink, MapPin, Building2, Tag, Heart } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getPromptData(promptId: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      batch: true,
      results: {
        include: { citations: true },
        orderBy: { platform: 'asc' },
      },
    },
  })
  return prompt
}

export default async function ResultsDetailPage({
  params,
}: {
  params: Promise<{ promptId: string }>
}) {
  const { promptId } = await params
  const prompt = await getPromptData(promptId)

  if (!prompt) notFound()

  const platformOrder = ['chatgpt', 'claude', 'perplexity', 'gemini', 'google_aio', 'google_ai_mode']
  const sortedResults = [...prompt.results].sort(
    (a, b) => platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform)
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-sm text-gray-600">Prompt Results</span>
      </div>

      {/* Prompt Metadata */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-lg font-medium text-gray-900 leading-relaxed">{prompt.promptText}</p>
            </div>
            <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'} className="flex-shrink-0">
              {prompt.promptType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Community</p>
                <p className="text-sm font-medium text-gray-900">{prompt.communityName || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">City / Market</p>
                <p className="text-sm font-medium text-gray-900">
                  {prompt.city}{prompt.market ? ` · ${prompt.market}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Category</p>
                <p className="text-sm font-medium text-gray-900">{prompt.category || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Level of Care</p>
                <p className="text-sm font-medium text-gray-900">{prompt.levelOfCare || '—'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Results */}
      {sortedResults.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No results yet for this prompt.</p>
            <Link href="/run" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              Run prompts →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedResults.map((result) => {
            const color = PLATFORM_COLORS[result.platform] || '#6366F1'
            const label = PLATFORM_LABELS[result.platform] || result.platform

            return (
              <Card key={result.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <CardTitle className="text-base">{label}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.isMentioned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Mentioned
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Not Mentioned
                        </span>
                      )}
                      {result.isCited && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Cited
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 flex-1">
                  {/* Response Text */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Response</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{result.responseText}</p>
                  </div>

                  {/* Citations */}
                  {result.citations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                        Citations ({result.citations.length})
                      </p>
                      <div className="space-y-2">
                        {result.citations.map((citation) => (
                          <a
                            key={citation.id}
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors group"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-indigo-500" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{citation.title}</p>
                              <p className="text-xs text-gray-400">{citation.domain}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
