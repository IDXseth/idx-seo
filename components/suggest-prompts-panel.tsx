'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sparkles, Info, Globe2, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { KNOWN_LEVELS_OF_CARE } from '@/lib/normalize'

const SUGGESTION_CATEGORIES = [
  'General Discovery',
  'Care Specific',
  'Cost & Financial Planning',
  'Location Based',
  'Best Of',
  'Competitor / Options Comparison',
  'Caregiver & Family Support',
  'Daily Life & Amenities',
  'Policy & Logistics',
  'Reviews & Reputation',
]

// Shape returned by GET /api/competitors — the same Competitor records used
// for AI-mention tracking on the /competitors page. Reused here (rather than
// a second competitor list) as the domain-restricted web-search source for
// suggestion research.
interface Competitor {
  id: string
  brandName: string
  domain: string
  active: boolean
}

interface PromptSuggestion {
  category: string
  levelOfCare: string
  promptText: string
}

interface SuggestionResult {
  suggestions: PromptSuggestion[]
  groundedInGsc: boolean
  competitorDomains: string[]
  usedFallback: boolean
  note?: string
}

// ─── Competitor sites summary ───────────────────────────────────────────────
// Read-only here — competitors are managed once on /competitors (the same
// list used for AI-mention tracking) and reused as the domain-restricted
// web-search source for suggestion research, rather than keeping a second
// competitor list just for this feature.

function CompetitorSitesSummary({ competitors }: { competitors: Competitor[] }) {
  const active = competitors.filter((c) => c.active)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-[#177e89]" />
          <p className="text-sm font-semibold text-[#084c61]">Competitor sites used for research</p>
        </div>
        <Link href="/competitors" className="flex items-center gap-1 text-xs text-[#177e89] hover:underline whitespace-nowrap">
          Manage competitors <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="text-xs text-[#5a7a85] mb-3">
        Active competitors from your competitor list are researched with a domain-restricted web search when generating suggestions — the model can only search these exact domains for real FAQ/blog topics.
      </p>

      {active.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {active.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 bg-[#e6f2f5] border border-[#b8d8e0] text-[#084c61] text-xs px-2.5 py-1 rounded-full">
              {c.brandName} <span className="text-[#5a7a85]">({c.domain})</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#8aadb8]">
          No active competitors yet — suggestions will be generated from general knowledge instead. Add some on the{' '}
          <Link href="/competitors" className="text-[#177e89] hover:underline">Competitors</Link> page to ground research in their real content.
        </p>
      )}
    </div>
  )
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function SuggestPromptsPanel() {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loadingCompetitors, setLoadingCompetitors] = useState(true)

  const [communityName, setCommunityName] = useState('')
  const [city, setCity] = useState('')
  const [market, setMarket] = useState('')
  const [levelOfCare, setLevelOfCare] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...SUGGESTION_CATEGORIES])
  const [count, setCount] = useState(20)

  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<SuggestionResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [batchName, setBatchName] = useState('')
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [commitSuccess, setCommitSuccess] = useState<{ promptCount: number; skippedCount: number } | null>(null)

  useEffect(() => {
    fetch('/api/competitors')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCompetitors(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingCompetitors(false))
  }, [])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])
  }

  const handleGenerate = async () => {
    if (!communityName.trim()) { setGenerateError('Community name is required'); return }
    setGenerating(true)
    setGenerateError(null)
    setResult(null)
    setCommitSuccess(null)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityName, city, market, levelOfCare,
          categories: selectedCategories,
          count,
        }),
      })
      const data: SuggestionResult = await res.json()
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || 'Failed to generate suggestions')
      setResult(data)
      setSelected(new Set(data.suggestions.map((_, i) => i)))
      setBatchName(`${communityName} — AI Suggested`)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setGenerating(false)
    }
  }

  const toggleRow = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleCommit = async () => {
    if (!result || selected.size === 0) return
    setCommitting(true)
    setCommitError(null)
    try {
      const chosen = result.suggestions.filter((_, i) => selected.has(i))
      const res = await fetch('/api/suggestions/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchName, communityName, city, market,
          promptType: 'nonbrand',
          prompts: chosen,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save prompts')
      setCommitSuccess({ promptCount: data.promptCount, skippedCount: data.skippedCount })
      setTimeout(() => router.push('/run'), 2000)
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Failed to save prompts')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Competitor sites */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-5">
        {loadingCompetitors ? (
          <p className="text-sm text-[#8aadb8]">Loading competitor sites…</p>
        ) : (
          <CompetitorSitesSummary competitors={competitors} />
        )}
      </div>

      {/* Generation form */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#177e89]" />
          <p className="text-sm font-semibold text-[#084c61]">Generate nonbrand prompt suggestions</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Community name <span className="text-rose-500">*</span></label>
            <input type="text" value={communityName} onChange={(e) => setCommunityName(e.target.value)} placeholder="e.g. The Glen at Lakewood"
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Level of care</label>
            <select value={levelOfCare} onChange={(e) => setLevelOfCare(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]">
              <option value="">— Any —</option>
              {KNOWN_LEVELS_OF_CARE.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chicago"
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Market</label>
            <input type="text" value={market} onChange={(e) => setMarket(e.target.value)} placeholder="Chicago Metro"
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#5a7a85] block mb-1.5">Categories</label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTION_CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat)
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-[#084c61] border-[#084c61] text-white'
                      : 'bg-white border-[#dde6ea] text-[#5a7a85] hover:border-[#8aadb8]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Number of prompts</label>
            <input type="number" min={1} max={60} value={count} onChange={(e) => setCount(Number(e.target.value))}
              className="w-28 px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
          </div>
          <Button onClick={handleGenerate} disabled={generating || selectedCategories.length === 0}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {generating ? 'Generating…' : 'Generate suggestions'}
          </Button>
        </div>

        {generateError && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <p className="text-xs text-rose-700">{generateError}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
          <div className="px-6 py-3 bg-[#e6f2f5] border-b border-[#b8d8e0] flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#177e89] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#084c61] space-y-0.5">
              <p>
                {result.usedFallback ? 'Generated from local templates.' : 'Generated with AI research.'}{' '}
                {result.groundedInGsc ? 'Grounded in your Search Console query data.' : 'No Search Console query data was available yet.'}{' '}
                {result.competitorDomains.length > 0
                  ? `Researched: ${result.competitorDomains.join(', ')}.`
                  : 'No competitor sites were added, so no site research was performed.'}
              </p>
              {result.note && <p className="text-[#5a7a85]">{result.note}</p>}
            </div>
          </div>

          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{result.suggestions.length} suggestions — {selected.size} selected</p>
              <div className="flex gap-3 mt-1">
                <button onClick={() => setSelected(new Set(result.suggestions.map((_, i) => i)))} className="text-xs text-[#177e89] hover:underline">Select all</button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-[#177e89] hover:underline">Select none</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text" value={batchName} onChange={(e) => setBatchName(e.target.value)}
                placeholder="Batch name"
                className="px-3 py-1.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] w-56"
              />
              <Button onClick={handleCommit} disabled={committing || selected.size === 0}>
                {committing ? 'Saving…' : `Add ${selected.size} to new batch`}
              </Button>
            </div>
          </div>

          {commitSuccess && (
            <div className="mx-6 mt-4 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">
                Saved {commitSuccess.promptCount} prompt{commitSuccess.promptCount !== 1 ? 's' : ''}
                {commitSuccess.skippedCount > 0 ? ` (${commitSuccess.skippedCount} duplicates skipped)` : ''} — redirecting to Run Prompts…
              </p>
            </div>
          )}
          {commitError && (
            <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              <p className="text-xs text-rose-700">{commitError}</p>
            </div>
          )}

          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Category</TableHead>
                  <TableHead>Level of Care</TableHead>
                  <TableHead>Prompt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.suggestions.map((s, i) => (
                  <TableRow key={i} className={selected.has(i) ? '' : 'opacity-40'}>
                    <TableCell>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} />
                    </TableCell>
                    <TableCell><Badge variant="secondary">{s.category}</Badge></TableCell>
                    <TableCell className="text-slate-500 text-xs">{s.levelOfCare || '—'}</TableCell>
                    <TableCell className="text-slate-700 text-sm">{s.promptText}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
