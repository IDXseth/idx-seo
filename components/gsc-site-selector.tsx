'use client'

import { useEffect, useState } from 'react'
import { Globe, ChevronDown, Check, Loader2 } from 'lucide-react'
import { signIn } from 'next-auth/react'

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
        // silently ignore network errors
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function selectSite(siteUrl: string) {
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
      <div className="flex items-center gap-2 text-sm text-[#5a7a85]">
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        <span>Loading…</span>
      </div>
    )
  }

  // Not connected — show connect button
  if (sites.length === 0) {
    return (
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard?tab=optimization' }, { prompt: 'consent', access_type: 'offline' })}
        className="flex-shrink-0 px-4 py-2 rounded-lg bg-[#084c61] text-white text-xs font-semibold hover:bg-[#177e89] transition-colors whitespace-nowrap"
      >
        Connect with Google
      </button>
    )
  }

  // Connected — show domain picker
  const displayUrl = selected
    ? selected.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'Select domain…'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#dde6ea] bg-white text-sm text-[#084c61] hover:bg-[#f0f7f9] transition-colors"
      >
        <Globe className="h-4 w-4 text-[#5a7a85] flex-shrink-0" />
        <span className="max-w-[200px] truncate">{displayUrl}</span>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8aadb8]" />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 text-[#8aadb8] transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white rounded-xl border border-[#dde6ea] shadow-lg overflow-hidden z-[60] max-h-60 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-[#8aadb8] uppercase tracking-wide border-b border-[#dde6ea]">
            Search Console Property
          </p>
          {sites.map((site) => (
            <button
              key={site.siteUrl}
              onClick={() => selectSite(site.siteUrl)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#084c61] hover:bg-[#f0f7f9] transition-colors"
            >
              <Check className={`h-4 w-4 flex-shrink-0 ${site.siteUrl === selected ? 'text-emerald-500' : 'text-transparent'}`} />
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
