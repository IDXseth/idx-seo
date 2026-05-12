'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Play, CheckCircle2, AlertCircle, RefreshCw, BarChart3, Circle, Mail } from 'lucide-react'
import Link from 'next/link'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'

interface BatchInfo {
  id: string
  name: string
  fileName: string
  createdAt: string
  _count: { prompts: number }
  unrunCount: number
}

interface PlatformStatus {
  platform: string
  isMentioned: boolean
  isCited: boolean
  error: string | null
}

interface ProgressEntry {
  processed: number
  total: number
  prompt: string
  community: string
  platformResults: PlatformStatus[]
}

export default function RunPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([])
  const [done, setDone] = useState<{ processed: number; errors: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/batches')
      if (res.ok) setBatches(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBatches() }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progressLog])

  const runPrompts = async (batchId?: string) => {
    const trimmedEmail = notifyEmail.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address')
      return
    }
    setEmailError(null)
    setRunning(batchId ?? 'all')
    setProgress(0)
    setProgressLog([])
    setDone(null)
    setError(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(batchId ? { batchId } : {}),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Run failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'start') {
              setProgress(0)
            } else if (event.type === 'progress') {
              setProgress(Math.round((event.processed / event.total) * 100))
              setProgressLog((prev) => [...prev, event as ProgressEntry])
            } else if (event.type === 'done') {
              setProgress(100)
              setDone({ processed: event.processed, errors: event.errors })
              await fetchBatches()
            }
          } catch {
            // malformed event
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(null)
    }
  }

  const totalUnrun = batches.reduce((sum, b) => sum + b.unrunCount, 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>Run Prompts</h1>
          <p className="text-[#5a7a85] mt-1 text-sm">Send prompts to 6 AI platforms and capture responses</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchBatches} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {totalUnrun > 0 && (
            <Button onClick={() => runPrompts()} disabled={running !== null}>
              <Play className="h-4 w-4 mr-2" />
              Run All Unrun ({totalUnrun})
            </Button>
          )}
        </div>
      </div>

      {/* Email notification input */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-[#177e89]" />
          <p className="text-sm font-semibold text-[#084c61]">Email notification (optional)</p>
        </div>
        <p className="text-xs text-[#5a7a85] mb-3">
          Enter your email to receive a summary when the run completes — useful if you want to close this tab while prompts process in the background.
        </p>
        <input
          type="email"
          value={notifyEmail}
          onChange={(e) => { setNotifyEmail(e.target.value); setEmailError(null) }}
          placeholder="you@example.com"
          disabled={running !== null}
          className="w-full max-w-sm px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent disabled:opacity-50 disabled:bg-[#f5f8fa]"
        />
        {emailError && (
          <p className="text-xs text-rose-500 mt-1.5">{emailError}</p>
        )}
        {notifyEmail.trim() && !emailError && (
          <p className="text-xs text-[#177e89] mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            A summary will be emailed to {notifyEmail.trim()} when the run finishes
          </p>
        )}
      </div>

      {running !== null && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="h-5 w-5 text-[#177e89] animate-spin" />
              <span className="text-sm font-medium text-[#084c61]">
                Querying AI platforms in real time…
              </span>
              <span className="ml-auto text-sm text-[#5a7a85]">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-4" />

            {progressLog.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {progressLog.map((entry, i) => (
                  <div key={i} className="border border-[#eef3f5] rounded-lg p-2 bg-[#f5f8fa]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[#084c61] truncate max-w-xs">
                        {entry.community}
                      </span>
                      <span className="text-[#8aadb8] ml-2">{entry.processed}/{entry.total}</span>
                    </div>
                    <p className="text-[#5a7a85] truncate mb-1.5">{entry.prompt}</p>
                    <div className="flex flex-wrap gap-1">
                      {entry.platformResults.map(({ platform, isMentioned, isCited, error }) => (
                        <span
                          key={platform}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${PLATFORM_COLORS[platform]}22`,
                            color: PLATFORM_COLORS[platform],
                          }}
                        >
                          {error ? (
                            <AlertCircle className="h-2.5 w-2.5" />
                          ) : isCited ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : isMentioned ? (
                            <Circle className="h-2.5 w-2.5 fill-current" />
                          ) : (
                            <Circle className="h-2.5 w-2.5" />
                          )}
                          {PLATFORM_LABELS[platform]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {done && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              {done.processed > 0
                ? `Ran ${done.processed} prompt${done.processed !== 1 ? 's' : ''} across all 6 platforms${done.errors > 0 ? ` (${done.errors} platform errors)` : ''}`
                : 'No prompts to run'}
            </p>
            {done.processed > 0 && notifyEmail.trim() && (
              <p className="text-xs text-emerald-600 mt-0.5">Summary email sent to {notifyEmail.trim()}</p>
            )}
            {done.processed > 0 && (
              <Link href="/dashboard" className="text-sm text-emerald-700 underline">
                View Dashboard →
              </Link>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[#5a7a85] mb-4">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Cited</span>
        <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-[#8aadb8] text-[#8aadb8]" /> Mentioned only</span>
        <span className="flex items-center gap-1"><Circle className="h-3 w-3 text-[#8aadb8]" /> Not mentioned</span>
        <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-rose-400" /> Error</span>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-[#5a7a85]">Loading batches…</CardContent>
        </Card>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-[#b8cdd3] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#084c61] mb-2">No batches yet</h3>
            <p className="text-[#5a7a85] mb-4">Upload a spreadsheet first to create a batch of prompts.</p>
            <Link href="/upload"><Button>Upload Spreadsheet</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <Card key={batch.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#084c61]">{batch.name}</h3>
                    <p className="text-sm text-[#5a7a85] mt-0.5">{batch.fileName}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-[#5a7a85]">{batch._count.prompts} prompts</span>
                      {batch.unrunCount > 0 ? (
                        <Badge variant="warning">{batch.unrunCount} unrun</Badge>
                      ) : (
                        <Badge variant="success">All run</Badge>
                      )}
                      <span className="text-xs text-[#8aadb8]">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {batch.unrunCount > 0 && (
                      <Button
                        size="sm"
                        onClick={() => runPrompts(batch.id)}
                        disabled={running !== null}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Run Batch
                      </Button>
                    )}
                    <Link href="/dashboard">
                      <Button variant="outline" size="sm">View Results</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
