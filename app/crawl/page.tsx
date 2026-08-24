'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileSpreadsheet, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CrawlBatchSummary {
  id: string
  name: string
  fileName: string
  status: string
  totalPages: number
  donePages: number
  createdAt: string
}

function statusBadge(status: string) {
  if (status === 'done') return <Badge variant="success">Done</Badge>
  if (status === 'analyzing') return <Badge variant="warning">Analyzing</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

export default function CrawlUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [batchName, setBatchName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [crawlBatches, setCrawlBatches] = useState<CrawlBatchSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/crawl')
      const data = await res.json()
      setCrawlBatches(data.crawlBatches ?? [])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadBatches()
    const interval = setInterval(loadBatches, 5000)
    return () => clearInterval(interval)
  }, [loadBatches])

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('Please upload the .csv or .xlsx export from Screaming Frog')
      return
    }
    setFile(f)
    setError(null)
    setBatchName(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('batchName', batchName || file.name)
      const res = await fetch('/api/crawl/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setFile(null)
      setBatchName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadBatches()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
          Page Recommendations
        </h1>
        <p className="text-[#5a7a85] mt-1 text-sm">
          Upload a Screaming Frog crawl export to get Claude-generated, page-level SEO recommendations.
        </p>
      </div>

      <div className="bg-[#e6f2f5] border border-[#b8d8e0] rounded-xl p-4 mb-6 flex gap-3">
        <Info className="h-4 w-4 text-[#177e89] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#084c61] mb-1">How to get the file</p>
          <p className="text-xs text-[#177e89]">
            In Screaming Frog SEO Spider, crawl the site, then use{' '}
            <span className="font-mono">Export &gt; Internal &gt; All</span> (or run headless via the CLI with{' '}
            <span className="font-mono">--export-tabs &quot;Internal:All&quot;</span>) and upload the resulting CSV or XLSX here.
          </p>
        </div>
      </div>

      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center transition-all mb-6',
          isDragging ? 'border-[#177e89] bg-[#e6f2f5]' :
          file ? 'border-emerald-400 bg-emerald-50' :
          'border-[#dde6ea] bg-white hover:border-[#8aadb8] hover:bg-[#f5f8fa]'
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
      >
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{file.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload & analyze'}
              </Button>
              <button
                onClick={() => { setFile(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-slate-100 rounded-xl">
              <Upload className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Drag & drop your Screaming Frog export here</p>
              <p className="text-sm text-slate-400 mt-0.5">Supports .csv and .xlsx</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-1">
              Browse files
            </Button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-[#084c61]">Past crawls</h2>
        </div>
        {loadingList ? (
          <p className="text-sm text-slate-400 px-6 py-6">Loading…</p>
        ) : crawlBatches.length === 0 ? (
          <p className="text-sm text-slate-400 px-6 py-6">No crawls uploaded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crawlBatches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/crawl/${b.id}`} className="font-medium text-[#177e89] hover:underline">
                      {b.name}
                    </Link>
                  </TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell className="text-sm text-slate-500">{b.donePages} / {b.totalPages} pages</TableCell>
                  <TableCell className="text-sm text-slate-500">{new Date(b.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
