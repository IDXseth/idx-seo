'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Info, Plus, Trash2 } from 'lucide-react'
import { PRESET_LABELS, PRESET_NAMES, type IndustryPreset, type SegmentLabels } from '@/lib/segment-labels'

export interface ProjectFormValues {
  name: string
  primaryDomain: string
  brandNames: string[]
  additionalDomains: string[]
  sitemapUrl: string | null
  sitemapPathPrefix: string | null
  segmentLabels: SegmentLabels
}

interface CompetitorDraft {
  brandName: string
  domain: string
  aliases: string
}

const inputClass =
  'w-full rounded-lg border border-(--c-line) bg-white px-3 py-2 text-sm text-(--c-ink) placeholder:text-(--c-faint) focus:outline-none focus:ring-2 focus:ring-(--c-accent) disabled:bg-(--c-surface) disabled:text-(--c-muted)'

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-(--c-ink) mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-(--c-subtle) mt-1 leading-relaxed">{hint}</p>}
    </div>
  )
}

const lines = (list: string[]) => list.join('\n')
const splitLines = (value: string) => value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)

// Create mode (no projectId) also collects the starting competitor list and
// makes the new project active; edit mode saves brand settings only —
// competitors are managed on the Competitors page.
export function ProjectForm({
  projectId,
  initial,
  canEdit = true,
}: {
  projectId?: string
  initial?: ProjectFormValues
  canEdit?: boolean
}) {
  const isNew = !projectId
  const [name, setName] = useState(initial?.name ?? '')
  const [primaryDomain, setPrimaryDomain] = useState(initial?.primaryDomain ?? '')
  const [brandNames, setBrandNames] = useState(lines(initial?.brandNames ?? []))
  const [additionalDomains, setAdditionalDomains] = useState(lines(initial?.additionalDomains ?? []))
  const [sitemapUrl, setSitemapUrl] = useState(initial?.sitemapUrl ?? '')
  const [sitemapPathPrefix, setSitemapPathPrefix] = useState(initial?.sitemapPathPrefix ?? '')
  const [preset, setPreset] = useState<IndustryPreset>(initial?.segmentLabels.preset ?? 'general')
  // Only labels that differ from the preset's defaults are kept as overrides,
  // so switching presets updates any label the user hasn't customized.
  const customLabel = (key: 'entity' | 'levelOfCare' | 'market') =>
    initial && initial.segmentLabels[key] !== PRESET_LABELS[initial.segmentLabels.preset][key] ? initial.segmentLabels[key] : ''
  const [entityLabel, setEntityLabel] = useState(customLabel('entity'))
  const [serviceLabel, setServiceLabel] = useState(customLabel('levelOfCare'))
  const [marketLabel, setMarketLabel] = useState(customLabel('market'))
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([{ brandName: '', domain: '', aliases: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function updateCompetitor(idx: number, patch: Partial<CompetitorDraft>) {
    setCompetitors((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    const body = {
      name,
      primaryDomain,
      brandNames: splitLines(brandNames),
      additionalDomains: splitLines(additionalDomains),
      sitemapUrl,
      sitemapPathPrefix,
      segmentLabels: { preset, entity: entityLabel, levelOfCare: serviceLabel, market: marketLabel },
      ...(isNew ? { competitors: competitors.filter((c) => c.brandName.trim() && c.domain.trim()) } : {}),
    }
    try {
      const res = await fetch(isNew ? '/api/projects' : `/api/projects/${projectId}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save project')
      if (isNew) {
        // The new project is now active — continue to uploading its prompts.
        window.location.assign('/upload')
        return
      }
      setBrandNames(lines(data.brandNames))
      setAdditionalDomains(lines(data.additionalDomains))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const disabled = !canEdit || saving

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="bg-white rounded-xl border border-(--c-line) p-6 space-y-5">
        <h2 className="text-base font-semibold text-(--c-ink)">Brand</h2>
        <Field label="Project name" htmlFor="name">
          <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Senior Living" required disabled={disabled} />
        </Field>
        <Field label="Primary domain" htmlFor="primaryDomain" hint="Citations of this domain, or any subdomain of it, count as your brand being cited.">
          <input id="primaryDomain" className={inputClass} value={primaryDomain} onChange={(e) => setPrimaryDomain(e.target.value)} placeholder="acmeliving.com" required disabled={disabled} />
        </Field>
        <Field
          label="Brand names"
          htmlFor="brandNames"
          hint="One per line. An AI answer mentioning any of these (as whole words, any capitalization) counts as a brand mention. Defaults to the project name."
        >
          <textarea id="brandNames" rows={3} className={inputClass} value={brandNames} onChange={(e) => setBrandNames(e.target.value)} placeholder={'Acme Senior Living\nAcme'} disabled={disabled} />
        </Field>
        <Field label="Other owned domains" htmlFor="additionalDomains" hint="Optional, one per line — e.g. a careers or regional site that should also count as your citations.">
          <textarea id="additionalDomains" rows={2} className={inputClass} value={additionalDomains} onChange={(e) => setAdditionalDomains(e.target.value)} placeholder="acme-careers.com" disabled={disabled} />
        </Field>
      </section>

      <section className="bg-white rounded-xl border border-(--c-line) p-6 space-y-5">
        <h2 className="text-base font-semibold text-(--c-ink)">Site pages <span className="text-xs font-normal text-(--c-subtle)">(optional)</span></h2>
        <Field label="Sitemap URL" htmlFor="sitemapUrl" hint="Used to match tracked locations to your site's pages in the Optimization view.">
          <input id="sitemapUrl" className={inputClass} value={sitemapUrl} onChange={(e) => setSitemapUrl(e.target.value)} placeholder="https://www.acmeliving.com/sitemap.xml" disabled={disabled} />
        </Field>
        <Field label="Location page path prefix" htmlFor="sitemapPathPrefix" hint="Only sitemap URLs under this path are treated as location pages.">
          <input id="sitemapPathPrefix" className={inputClass} value={sitemapPathPrefix} onChange={(e) => setSitemapPathPrefix(e.target.value)} placeholder="/communities/" disabled={disabled} />
        </Field>
      </section>

      <section className="bg-white rounded-xl border border-(--c-line) p-6 space-y-5">
        <h2 className="text-base font-semibold text-(--c-ink)">Industry &amp; labels</h2>
        <Field
          label="Industry"
          htmlFor="preset"
          hint="Senior living adds care-level clean-up on upload (e.g. “AL” → Assisted Living) and senior-living prompt suggestions."
        >
          <select id="preset" className={inputClass} value={preset} onChange={(e) => setPreset(e.target.value as IndustryPreset)} disabled={disabled}>
            {(Object.keys(PRESET_NAMES) as IndustryPreset[]).map((p) => <option key={p} value={p}>{PRESET_NAMES[p]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Location label" htmlFor="entityLabel" hint="What each prompt's place or product is called.">
            <input id="entityLabel" className={inputClass} value={entityLabel} onChange={(e) => setEntityLabel(e.target.value)} placeholder={PRESET_LABELS[preset].entity} disabled={disabled} />
          </Field>
          <Field label="Service label" htmlFor="serviceLabel" hint="The offering a prompt is about.">
            <input id="serviceLabel" className={inputClass} value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)} placeholder={PRESET_LABELS[preset].levelOfCare} disabled={disabled} />
          </Field>
          <Field label="Market label" htmlFor="marketLabel" hint="A group of locations.">
            <input id="marketLabel" className={inputClass} value={marketLabel} onChange={(e) => setMarketLabel(e.target.value)} placeholder={PRESET_LABELS[preset].market} disabled={disabled} />
          </Field>
        </div>
      </section>

      {isNew && (
        <section className="bg-white rounded-xl border border-(--c-line) p-6">
          <h2 className="text-base font-semibold text-(--c-ink)">Competitors</h2>
          <p className="text-xs text-(--c-subtle) mt-1 mb-4">Tracked alongside your brand in every run. You can change these later on the Competitors page.</p>
          <div className="space-y-2 mb-3">
            {competitors.map((c, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-center">
                <input aria-label="Competitor name" className={inputClass} value={c.brandName} onChange={(e) => updateCompetitor(idx, { brandName: e.target.value })} placeholder="Brookdale Senior Living" disabled={disabled} />
                <input aria-label="Competitor domain" className={inputClass} value={c.domain} onChange={(e) => updateCompetitor(idx, { domain: e.target.value })} placeholder="brookdale.com" disabled={disabled} />
                <input aria-label="Competitor aliases" className={inputClass} value={c.aliases} onChange={(e) => updateCompetitor(idx, { aliases: e.target.value })} placeholder="Aliases, comma-separated" disabled={disabled} />
                <button type="button" onClick={() => setCompetitors((prev) => prev.filter((_, i) => i !== idx))} className="text-(--c-faint) hover:text-rose-500 transition-colors justify-self-center" aria-label="Remove competitor">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCompetitors((prev) => [...prev, { brandName: '', domain: '', aliases: '' }])}
            className="text-sm font-semibold text-(--c-accent) flex items-center gap-1.5 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add competitor
          </button>
        </section>
      )}

      {!isNew && canEdit && (
        <div className="flex gap-2 text-xs text-(--c-muted) bg-(--c-surface) border border-(--c-line-soft) rounded-lg p-3">
          <Info className="h-4 w-4 flex-shrink-0 text-(--c-accent)" />
          Changes apply to prompts run from now on. Results already collected keep the brand settings they were scored with.
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>
      )}

      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Saved</span>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create project' : 'Save changes'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-(--c-subtle) text-right">Only the project owner can change these settings.</p>
      )}
    </form>
  )
}
