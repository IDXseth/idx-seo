'use client'

import { useEffect, useState } from 'react'
import { Globe, ChevronDown, Check, Loader2, AlertCircle } from 'lucide-react'

interface GscSite {
  siteUrl: string
  permissionLevel: string
}

export function GscSiteSelector() {
  const [sites, setSites] = useState<GscSite[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [sitesRes, siteRes] = await Promise.all([
          fetch('/api/gsc/sites'),
          fetch('/api/gsc/site'),
        ])
        if (sitesRes.ok) {
          const data = await sitesRes.json()
          setSites(data.sites ?? [])
        }
        if (siteRes.ok) {
          const data = await siteRes.json()
          setSelected(data.siteUrl)
        }
      } catch {
        setError('Failed to load GSC sites')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function selectSite(siteUrl: string | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/gsc/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSelected(siteUrl)
      setOpen(false)
    } catch {
      setError('Failed to save selection')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#5a7a85]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading GSC sites…</span>
      </div>
    )
  }

  if (sites.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-[#5a7a85]">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>No GSC sites found. Sign in with Google.</span>
      </div>
    )
  }

  const displayUrl = selected
    ? selected.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'Select domain…'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#084c61] hover:bg-[#f0f7f9] transition-colors"
      >
        <Globe className="h-4 w-4 text-[#5a7a85] flex-shrink-0" />
        <span className="flex-1 text-left truncate max-w-[160px]">{displayUrl}</span>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8aadb8]" />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 text-[#8aadb8] transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {error && (
        <p className="px-4 py-1 text-xs text-rose-600">{error}</p>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl border border-[#dde6ea] shadow-lg overflow-hidden z-[60] max-h-60 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-[#8aadb8] uppercase tracking-wide border-b border-[#dde6ea]">
            Search Console Property
          </p>
          {sites.map((site) => (
            <button
              key={site.siteUrl}
              onClick={() => selectSite(site.siteUrl)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#084c61] hover:bg-[#f0f7f9] transition-colors"
            >
              <Check
                className={`h-4 w-4 flex-shrink-0 ${site.siteUrl === selected ? 'text-emerald-500' : 'text-transparent'}`}
              />
              <span className="flex-1 text-left truncate">{site.siteUrl}</span>
              <span className="text-xs text-[#8aadb8] flex-shrink-0">
                {site.permissionLevel === 'siteOwner' ? 'Owner' : 'Delegated'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
