'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Info, Plus, Trash2, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompetitorRow {
  id?: string
  brandName: string
  domain: string
  aliases: string
  active: boolean
  dirty?: boolean
}

function emptyRow(): CompetitorRow {
  return { brandName: '', domain: '', aliases: '', active: true, dirty: true }
}

export function CompetitorsManager({ promptCount }: { promptCount: number }) {
  const [rows, setRows] = useState<CompetitorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/competitors')
      .then((r) => r.json())
      .then((data: Array<{ id: string; brandName: string; domain: string; aliases: string; active: boolean }>) => {
        setRows(data.length > 0 ? data.map((c) => ({ ...c, dirty: false })) : [emptyRow()])
      })
      .catch(() => setRows([emptyRow()]))
      .finally(() => setLoading(false))
  }, [])

  const updateRow = useCallback((idx: number, patch: Partial<CompetitorRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r)))
  }, [])

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow()])
  }, [])

  const removeRow = useCallback(async (idx: number) => {
    const row = rows[idx]
    if (row.id) {
      await fetch(`/api/competitors/${row.id}`, { method: 'DELETE' }).catch(() => {})
    }
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }, [rows])

  const activeCount = rows.filter((r) => r.active && r.brandName.trim() && r.domain.trim()).length
  const filledCount = rows.filter((r) => r.brandName.trim() && r.domain.trim()).length

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const results = await Promise.all(
        rows.map(async (row) => {
          if (!row.brandName.trim() || !row.domain.trim()) return row
          if (!row.dirty) return row

          const body = { brandName: row.brandName.trim(), domain: row.domain.trim(), aliases: row.aliases.trim(), active: row.active }
          const res = row.id
            ? await fetch(`/api/competitors/${row.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
            : await fetch('/api/competitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
          if (!res.ok) throw new Error(`Failed to save "${row.brandName || 'competitor'}"`)
          const saved = await res.json()
          return { ...saved, dirty: false } as CompetitorRow
        })
      )
      setRows(results)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save competitors')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8aadb8]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>Track Competitors</h1>
        <p className="text-[#5a7a85] mt-1 text-sm">Add named competitors to monitor their mentions, citations, and sentiment alongside your own.</p>
      </div>

      <div className="bg-[#e6f2f5] border border-[#b8d8e0] rounded-xl p-4 mb-6 flex gap-3">
        <Info className="h-4 w-4 text-[#177e89] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#084c61] leading-relaxed">
          <span className="font-semibold">Applied to your existing prompt set — </span>
          These competitors will be evaluated against the{' '}
          <span className="font-semibold">{promptCount.toLocaleString()} prompt{promptCount !== 1 ? 's' : ''}</span>{' '}
          you&apos;ve already configured. No need to duplicate or re-upload anything — every future run session will detect
          competitor mentions, citations, and sentiment right alongside your own.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden mb-4">
        <div className="grid grid-cols-[1.3fr_1.3fr_1.6fr_0.7fr_32px] gap-3.5 px-5 py-3 bg-[#f5f8fa] border-b border-[#eef3f5]">
          <span className="text-[10px] font-bold text-[#8aadb8] uppercase tracking-wide">Competitor Brand</span>
          <span className="text-[10px] font-bold text-[#8aadb8] uppercase tracking-wide">Domain</span>
          <span className="text-[10px] font-bold text-[#8aadb8] uppercase tracking-wide">Aliases / AKA</span>
          <span className="text-[10px] font-bold text-[#8aadb8] uppercase tracking-wide">Tracking</span>
          <span />
        </div>

        {rows.map((row, idx) => (
          <div
            key={row.id ?? `new-${idx}`}
            className={cn(
              'grid grid-cols-[1.3fr_1.3fr_1.6fr_0.7fr_32px] gap-3.5 items-center px-5 py-3',
              idx !== rows.length - 1 && 'border-b border-[#eef3f5]',
              !row.active && 'opacity-55'
            )}
          >
            <input
              type="text"
              value={row.brandName}
              onChange={(e) => updateRow(idx, { brandName: e.target.value })}
              placeholder="Brookdale Senior Living"
              className="px-2.5 py-1.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent"
            />
            <div className="relative">
              <Globe className="h-3.5 w-3.5 text-[#b8cdd3] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={row.domain}
                onChange={(e) => updateRow(idx, { domain: e.target.value })}
                placeholder="brookdale.com"
                className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent"
              />
            </div>
            <input
              type="text"
              value={row.aliases}
              onChange={(e) => updateRow(idx, { aliases: e.target.value })}
              placeholder="Brookdale, Brookdale Assisted Living"
              className="px-2.5 py-1.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent"
            />
            <button
              type="button"
              role="switch"
              aria-checked={row.active}
              onClick={() => updateRow(idx, { active: !row.active })}
              className={cn(
                'w-[34px] h-[19px] rounded-full relative transition-colors flex-shrink-0',
                row.active ? 'bg-[#177e89]' : 'bg-[#dde6ea]'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all',
                  row.active ? 'right-0.5' : 'left-0.5'
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="text-[#b8cdd3] hover:text-rose-500 transition-colors"
              aria-label="Remove competitor"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-full border-2 border-dashed border-[#dde6ea] hover:border-[#177e89] hover:bg-[#f5f8fa] rounded-lg py-2.5 text-sm font-semibold text-[#177e89] flex items-center justify-center gap-1.5 transition-colors mb-6"
      >
        <Plus className="h-3.5 w-3.5" />
        Add competitor
      </button>

      <div className="bg-[#f5f8fa] border border-[#eef3f5] rounded-xl p-4 mb-7">
        <p className="text-[11px] font-bold text-[#8aadb8] uppercase tracking-wide mb-2">How matching works</p>
        <div className="space-y-1.5">
          <p className="text-xs text-[#5a7a85] leading-relaxed">
            <span className="font-semibold text-[#084c61]">Domain</span> — a citation counts for this competitor when the cited URL&apos;s domain matches exactly, or is a known subdomain (e.g. reviews.brookdale.com).
          </p>
          <p className="text-xs text-[#5a7a85] leading-relaxed">
            <span className="font-semibold text-[#084c61]">Aliases</span> — the response text is scanned case-insensitively for any alias to catch a mention even when the AI doesn&apos;t include a link.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-[#dde6ea]">
        <p className="text-xs text-[#8aadb8]">
          <span className="font-semibold text-[#5a7a85]">{filledCount} competitor{filledCount !== 1 ? 's' : ''} added</span>
          {' '}· {activeCount} active
          {savedAt && (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium ml-2">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save & Start Tracking'}
        </Button>
      </div>
    </div>
  )
}
