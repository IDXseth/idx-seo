'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Play, CheckCircle2, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface BatchInfo {
  id: string
  name: string
  fileName: string
  createdAt: string
  _count: { prompts: number }
  unrunCount: number
}

export default function RunPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null) // 'all' or batchId
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ processed: number; message?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/batches')
      if (res.ok) {
        const data = await res.json()
        setBatches(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const runPrompts = async (batchId?: string) => {
    setRunning(batchId || 'all')
    setProgress(0)
    setResult(null)
    setError(null)

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 90))
    }, 200)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchId ? { batchId } : {}),
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Run failed')
      }

      const data = await res.json()
      setResult(data)
      await fetchBatches()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      clearInterval(progressInterval)
      setRunning(null)
    }
  }

  const totalUnrun = batches.reduce((sum, b) => sum + b.unrunCount, 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Run Prompts</h1>
          <p className="text-gray-500 mt-1">Generate AI responses for your uploaded prompts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchBatches} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {totalUnrun > 0 && (
            <Button
              onClick={() => runPrompts()}
              disabled={running !== null}
            >
              <Play className="h-4 w-4 mr-2" />
              Run All Unrun ({totalUnrun} prompts)
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {running !== null && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-gray-700">
                Running prompts against 6 AI platforms...
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {result.processed > 0
                ? `Successfully ran ${result.processed} prompt${result.processed !== 1 ? 's' : ''} across all platforms`
                : result.message || 'No prompts to run'}
            </p>
            {result.processed > 0 && (
              <Link href="/dashboard" className="text-sm text-green-700 underline">
                View Dashboard
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Batches */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Loading batches...</CardContent>
        </Card>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No batches yet</h3>
            <p className="text-gray-500 mb-4">Upload a spreadsheet first to create a batch of prompts.</p>
            <Link href="/upload">
              <Button>Upload Spreadsheet</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <Card key={batch.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{batch.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{batch.fileName}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-gray-600">{batch._count.prompts} prompts</span>
                      {batch.unrunCount > 0 ? (
                        <Badge variant="warning">{batch.unrunCount} unrun</Badge>
                      ) : (
                        <Badge variant="success">All run</Badge>
                      )}
                      <span className="text-xs text-gray-400">
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
                      <Button variant="outline" size="sm">
                        View Results
                      </Button>
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
