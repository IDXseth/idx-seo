'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParsedRow {
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  promptText: string
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '_')
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  const normalized = Object.keys(row).reduce((acc, k) => {
    acc[normalizeKey(k)] = row[k]
    return acc
  }, {} as Record<string, unknown>)
  for (const key of keys) {
    const val = normalized[normalizeKey(key)]
    if (val !== undefined && val !== null && val !== '') return String(val).trim()
  }
  return ''
}

function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<string, unknown>[]
        resolve(rows.map((row) => ({
          promptType: getField(row, 'prompt_type', 'type', 'promptType') || 'nonbrand',
          category: getField(row, 'category'),
          communityName: getField(row, 'community_name', 'community', 'communityName'),
          city: getField(row, 'city'),
          market: getField(row, 'market'),
          levelOfCare: getField(row, 'level_of_care', 'care_level', 'levelOfCare'),
          promptText: getField(row, 'prompt', 'prompt_text', 'promptText'),
        })))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

const EXPECTED_COLUMNS = ['prompt_type', 'category', 'community_name', 'city', 'market', 'level_of_care', 'prompt']

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [batchName, setBatchName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [skippedCount, setSkippedCount] = useState(0)

  const handleFile = async (f: File) => {
    if (!f.name.match(/\.(xlsx|csv|xls)$/i)) {
      setError('Please upload an .xlsx, .xls, or .csv file')
      return
    }
    setFile(f)
    setError(null)
    setBatchName(f.name.replace(/\.[^.]+$/, ''))
    try {
      setPreview(await parseSpreadsheet(f))
    } catch {
      setError('Failed to parse file. Please check the format.')
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) await handleFile(f)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) await handleFile(f)
  }

  const handleUpload = async () => {
    if (!file || preview.length === 0) return
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('batchName', batchName || file.name)
      const progressInterval = setInterval(() => setUploadProgress((p) => Math.min(p + 10, 90)), 100)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      clearInterval(progressInterval)
      setUploadProgress(100)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSkippedCount(data.skippedCount ?? 0)
      setSuccess(true)
      setTimeout(() => router.push('/run'), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview([])
    setBatchName('')
    setError(null)
    setSuccess(false)
    setSkippedCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>Upload Prompts</h1>
        <p className="text-[#5a7a85] mt-1 text-sm">Upload a spreadsheet with your prompt data to get started</p>
      </div>

      {/* Format guide */}
      <div className="bg-[#e6f2f5] border border-[#b8d8e0] rounded-xl p-4 mb-6 flex gap-3">
        <Info className="h-4 w-4 text-[#177e89] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#084c61] mb-2">Expected spreadsheet columns</p>
          <div className="flex flex-wrap gap-1.5">
            {EXPECTED_COLUMNS.map((col) => (
              <code key={col} className="text-xs bg-white border border-[#b8d8e0] text-[#084c61] px-2 py-0.5 rounded-md font-mono">
                {col}
              </code>
            ))}
          </div>
          <p className="text-xs text-[#177e89] mt-2">Column names are flexible — underscores, spaces, and camelCase are all recognized.</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center transition-all mb-6',
          isDragging ? 'border-[#177e89] bg-[#e6f2f5]' :
          file ? 'border-emerald-400 bg-emerald-50' :
          'border-[#dde6ea] bg-white hover:border-[#8aadb8] hover:bg-[#f5f8fa]'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{preview.length} rows parsed</p>
            </div>
            <button onClick={clearFile} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-500 transition-colors">
              <X className="h-3.5 w-3.5" /> Remove file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-slate-100 rounded-xl">
              <Upload className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Drag & drop your spreadsheet here</p>
              <p className="text-sm text-slate-400 mt-0.5">Supports .xlsx, .xls, and .csv</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-1">
              Browse files
            </Button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} className="hidden" />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Upload successful! Redirecting to Run Prompts…</p>
          </div>
          {skippedCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-[#e6f2f5] border border-[#b8d8e0] rounded-xl">
              <Info className="h-5 w-5 text-[#177e89] flex-shrink-0" />
              <p className="text-sm text-[#084c61]">
                <span className="font-semibold">{skippedCount} prompt{skippedCount !== 1 ? 's' : ''}</span> already exist in your account and were not added again.
              </p>
            </div>
          )}
        </div>
      )}

      {preview.length > 0 && !success && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900 text-sm">Preview</p>
              <p className="text-xs text-slate-400 mt-0.5">{preview.length} rows detected</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Batch name"
                className="px-3 py-1.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent w-44"
              />
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Confirm Upload'}
              </Button>
            </div>
          </div>
          {uploading && (
            <div className="px-6 pt-3 pb-0">
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          )}
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Community</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Level of Care</TableHead>
                  <TableHead>Prompt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant={row.promptType === 'brand' ? 'default' : 'secondary'}>
                        {row.promptType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">{row.communityName || '—'}</TableCell>
                    <TableCell className="text-slate-500">{row.city || '—'}</TableCell>
                    <TableCell className="text-slate-500">{row.market || '—'}</TableCell>
                    <TableCell className="text-slate-500">{row.category || '—'}</TableCell>
                    <TableCell className="text-slate-500">{row.levelOfCare || '—'}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-slate-700 text-xs">{row.promptText}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.length > 50 && (
              <p className="text-center text-xs text-slate-400 py-3 border-t border-slate-100">
                Showing 50 of {preview.length} rows
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
