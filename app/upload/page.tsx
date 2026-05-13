'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react'

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
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim()
    }
  }
  return ''
}

function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

        const parsed: ParsedRow[] = rows.map((row) => ({
          promptType: getField(row, 'prompt_type', 'type', 'promptType') || 'nonbrand',
          category: getField(row, 'category'),
          communityName: getField(row, 'community_name', 'community', 'communityName'),
          city: getField(row, 'city'),
          market: getField(row, 'market'),
          levelOfCare: getField(row, 'level_of_care', 'care_level', 'levelOfCare'),
          promptText: getField(row, 'prompt', 'prompt_text', 'promptText'),
        }))

        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

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

  const handleFile = async (f: File) => {
    if (!f.name.match(/\.(xlsx|csv|xls)$/i)) {
      setError('Please upload an .xlsx, .xls, or .csv file')
      return
    }

    setFile(f)
    setError(null)
    setBatchName(f.name.replace(/\.[^.]+$/, ''))

    try {
      const rows = await parseSpreadsheet(f)
      setPreview(rows)
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

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

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 90))
      }, 100)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(true)
      setTimeout(() => router.push('/run'), 1500)
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Prompts</h1>
        <p className="text-gray-500 mt-1">Upload a spreadsheet with your prompt data</p>
      </div>

      {/* Format Guide */}
      <Card className="mb-6 bg-indigo-50 border-indigo-200">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-indigo-800 mb-2">Expected Columns:</p>
          <div className="flex flex-wrap gap-2">
            {['prompt_type', 'category', 'community_name', 'city', 'market', 'level_of_care', 'prompt'].map((col) => (
              <code key={col} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                {col}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-indigo-400 bg-indigo-50'
                : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet className="h-12 w-12 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{preview.length} rows parsed</p>
                </div>
                <button
                  onClick={clearFile}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"
                >
                  <X className="h-4 w-4" /> Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-12 w-12 text-gray-300" />
                <div>
                  <p className="text-gray-600 font-medium">Drag & drop your spreadsheet here</p>
                  <p className="text-sm text-gray-400">or click to browse (.xlsx, .csv)</p>
                </div>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Browse Files
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">Upload successful! Redirecting to Run Prompts...</p>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && !success && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview ({preview.length} rows)</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Batch name"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </Button>
              </div>
            </div>
            {uploading && (
              <div className="mt-3">
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
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
                      <TableCell className="font-medium">{row.communityName || '—'}</TableCell>
                      <TableCell>{row.city || '—'}</TableCell>
                      <TableCell>{row.market || '—'}</TableCell>
                      <TableCell>{row.category || '—'}</TableCell>
                      <TableCell>{row.levelOfCare || '—'}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{row.promptText}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 50 && (
                <p className="text-center text-sm text-gray-500 py-3">
                  Showing 50 of {preview.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
