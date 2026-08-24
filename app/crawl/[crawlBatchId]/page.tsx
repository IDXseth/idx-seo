'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageRow {
  id: string
  url: string
  statusCode: number | null
  indexability: string | null
  title: string | null
  titleLength: number | null
  metaDescription: string | null
  metaDescriptionLength: number | null
  wordCount: number | null
  gsc: { clicks: number; impressions: number; position: number | null } | null
  recommendation: {
    priority: string
    summary: string
    issues: string[]
    recommendations: string[]
  } | null
}

interface CrawlBatchDetail {
  id: string
  name: string
  status: string
  totalPages: number
  donePages: number
  pages: PageRow[]
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function priorityBadge(priority: string | undefined) {
  if (priority === 'high') return <Badge variant="destructive">High</Badge>
  if (priority === 'medium') return <Badge variant="warning">Medium</Badge>
  if (priority === 'low') return <Badge variant="success">Low</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

export default function CrawlDetailPage() {
  const params = useParams<{ crawlBatchId: string }>()
  const [batch, setBatch] = useState<CrawlBatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crawl/${params.crawlBatchId}`)
      if (res.ok) setBatch(await res.json())
    } finally {
      setLoading(false)
    }
  }, [params.crawlBatchId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!batch) return <p className="text-sm text-slate-400">Crawl not found.</p>

  const sortedPages = [...batch.pages].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.recommendation?.priority ?? ''] ?? 3
    const pb = PRIORITY_ORDER[b.recommendation?.priority ?? ''] ?? 3
    return pa - pb
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
          {batch.name}
        </h1>
        {batch.status !== 'done' && (
          <div className="mt-3 max-w-sm">
            <p className="text-xs text-slate-500 mb-1">
              Analyzing pages… {batch.donePages} / {batch.totalPages}
            </p>
            <Progress value={batch.totalPages ? (batch.donePages / batch.totalPages) * 100 : 0} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>URL</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Title len</TableHead>
              <TableHead>Meta len</TableHead>
              <TableHead>Words</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPages.map((page) => (
              <>
                <TableRow
                  key={page.id}
                  className="cursor-pointer hover:bg-[#f5f8fa]"
                  onClick={() => setExpanded(expanded === page.id ? null : page.id)}
                >
                  <TableCell>
                    {expanded === page.id ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm text-[#177e89]">{page.url}</TableCell>
                  <TableCell>{priorityBadge(page.recommendation?.priority)}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {page.statusCode ?? '—'}
                    {page.indexability && page.indexability !== 'Indexable' && (
                      <span className="ml-1 text-rose-500">({page.indexability})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{page.titleLength ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-500">{page.metaDescriptionLength ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-500">{page.wordCount ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-500">{page.gsc?.clicks ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-500">{page.gsc?.position?.toFixed(1) ?? '—'}</TableCell>
                </TableRow>
                {expanded === page.id && (
                  <TableRow key={`${page.id}-detail`} className="bg-[#f5f8fa]">
                    <TableCell colSpan={9}>
                      {page.recommendation ? (
                        <div className="py-2 space-y-3">
                          <p className="text-sm font-medium text-slate-800">{page.recommendation.summary}</p>
                          {page.recommendation.issues.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Issues</p>
                              <ul className="list-disc list-inside text-sm text-slate-600 space-y-0.5">
                                {page.recommendation.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                              </ul>
                            </div>
                          )}
                          {page.recommendation.recommendations.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Recommendations</p>
                              <ul className="list-disc list-inside text-sm text-slate-600 space-y-0.5">
                                {page.recommendation.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className={cn('text-sm text-slate-400 py-2')}>Recommendation pending…</p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
