'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Play, CheckCircle2, AlertCircle, RefreshCw, BarChart3,
  Mail, Pencil, Trash2, Share2, X, Check, Link2, UserPlus,
  Calendar, Plus, Clock, RotateCcw,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchInfo {
  id: string
  name: string
  fileName: string
  createdAt: string
  userId?: string
  isPrivate: boolean
  shareToken?: string | null
  _count: { prompts: number }
  unrunCount: number
}

interface ShareEntry {
  id: string
  email: string
  createdAt: string
}

interface Schedule {
  id: string
  frequency: string
  customDays?: number | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  hour: number
  timezone: string
  enabled: boolean
  nextRunAt: string
  lastRunAt?: string | null
}

interface RunStatus {
  batchRunId: string
  totalPrompts: number
  doneCount: number
  failCount: number
  status: string
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LEVEL_OF_CARE_OPTIONS = ['', 'Assisted Living', 'Independent Living', 'Memory Care', 'Skilled Nursing', 'Short Term Care']

function formatScheduleLabel(s: Schedule): string {
  const hour = `${s.hour === 0 ? 12 : s.hour > 12 ? s.hour - 12 : s.hour}${s.hour >= 12 ? 'pm' : 'am'}`
  switch (s.frequency) {
    case 'daily': return `Daily at ${hour}`
    case 'weekly': return `Weekly on ${DAYS_OF_WEEK[s.dayOfWeek ?? 1]} at ${hour}`
    case 'monthly': return `Monthly on the ${s.dayOfMonth ?? 1} at ${hour}`
    case 'custom': return `Every ${s.customDays ?? 7} days at ${hour}`
    default: return s.frequency
  }
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────

function ScheduleModal({
  batch,
  onClose,
}: {
  batch: BatchInfo
  onClose: () => void
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [frequency, setFrequency] = useState('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [customDays, setCustomDays] = useState(7)
  const [hour, setHour] = useState(9)

  useEffect(() => {
    fetch(`/api/schedules?batchId=${batch.id}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSchedules(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [batch.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batch.id,
          frequency,
          dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
          dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
          customDays: frequency === 'custom' ? customDays : undefined,
          hour,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSchedules((prev) => [...prev, data])
        setShowForm(false)
      }
    } catch {} finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/schedules?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s))
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' })
    if (res.ok) setSchedules((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#dde6ea] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dde6ea]">
          <div>
            <h2 className="font-semibold text-[#084c61]">Scheduled Runs</h2>
            <p className="text-xs text-[#5a7a85] mt-0.5 truncate max-w-xs">{batch.name}</p>
          </div>
          <button onClick={onClose} className="text-[#8aadb8] hover:text-[#084c61] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading && <p className="text-sm text-[#8aadb8]">Loading…</p>}

          {!loading && schedules.length === 0 && !showForm && (
            <p className="text-sm text-[#5a7a85]">No schedules yet. Add one to run prompts automatically.</p>
          )}

          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-[#f5f8fa] rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#084c61]">{formatScheduleLabel(s)}</p>
                <p className="text-xs text-[#8aadb8] mt-0.5">
                  Next: {new Date(s.nextRunAt).toLocaleDateString()} — {s.enabled ? 'Active' : 'Paused'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(s.id, !s.enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${s.enabled ? 'bg-[#177e89]' : 'bg-[#c5d7de]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${s.enabled ? 'translate-x-4' : ''}`} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="text-[#b8cdd3] hover:text-rose-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {showForm ? (
            <div className="space-y-3 border border-[#dde6ea] rounded-xl p-4">
              <div>
                <label className="text-xs font-medium text-[#5a7a85] block mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom interval</option>
                </select>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <label className="text-xs font-medium text-[#5a7a85] block mb-1">Day of week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
                  >
                    {DAYS_OF_WEEK.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
              )}

              {frequency === 'monthly' && (
                <div>
                  <label className="text-xs font-medium text-[#5a7a85] block mb-1">Day of month</label>
                  <input
                    type="number" min={1} max={28} value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
                  />
                </div>
              )}

              {frequency === 'custom' && (
                <div>
                  <label className="text-xs font-medium text-[#5a7a85] block mb-1">Every N days</label>
                  <input
                    type="number" min={1} max={365} value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[#5a7a85] block mb-1">Hour of day (UTC)</label>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save schedule'}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-[#177e89] hover:text-[#084c61] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add schedule
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Prompt Modal ─────────────────────────────────────────────────────────

function AddPromptModal({
  batch,
  onClose,
  onAdded,
}: {
  batch: BatchInfo
  onClose: () => void
  onAdded: () => void
}) {
  const [promptText, setPromptText] = useState('')
  const [communityName, setCommunityName] = useState('')
  const [promptType, setPromptType] = useState('brand')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [market, setMarket] = useState('')
  const [levelOfCare, setLevelOfCare] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!promptText.trim() || !communityName.trim()) {
      setError('Prompt text and community name are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.id, promptText, communityName, promptType, category, city, market, levelOfCare }),
      })
      if (res.ok) {
        onAdded()
        onClose()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to add prompt')
      }
    } catch {
      setError('Failed to add prompt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[#dde6ea] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dde6ea]">
          <div>
            <h2 className="font-semibold text-[#084c61]">Add Prompt</h2>
            <p className="text-xs text-[#5a7a85] mt-0.5 truncate max-w-xs">{batch.name}</p>
          </div>
          <button onClick={onClose} className="text-[#8aadb8] hover:text-[#084c61] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Prompt text <span className="text-rose-500">*</span></label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              placeholder="e.g. What are the best assisted living communities in Chicago?"
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Community name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="e.g. The Glen at Lakewood"
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#5a7a85] block mb-1">Prompt type</label>
              <select
                value={promptType}
                onChange={(e) => setPromptType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
              >
                <option value="brand">Brand</option>
                <option value="nonbrand">Non-brand</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#5a7a85] block mb-1">Level of care</label>
              <select
                value={levelOfCare}
                onChange={(e) => setLevelOfCare(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
              >
                {LEVEL_OF_CARE_OPTIONS.map((o) => <option key={o} value={o}>{o || '— None —'}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#5a7a85] block mb-1">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chicago"
                className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5a7a85] block mb-1">Market</label>
              <input type="text" value={market} onChange={(e) => setMarket(e.target.value)} placeholder="Midwest"
                className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#5a7a85] block mb-1">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Discovery"
              className="w-full px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Adding…' : 'Add prompt'}</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({
  batch,
  onClose,
  onShareTokenChange,
}: {
  batch: BatchInfo
  onClose: () => void
  onShareTokenChange: (batchId: string, token: string | null) => void
}) {
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(batch.shareToken ?? null)
  const [togglingLink, setTogglingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadingShares, setLoadingShares] = useState(true)

  const shareUrl =
    typeof window !== 'undefined' && shareToken
      ? `${window.location.origin}/shared/${shareToken}`
      : null

  useEffect(() => {
    fetch(`/api/projects/${batch.id}/share`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setShares(data) })
      .catch(() => {})
      .finally(() => setLoadingShares(false))
  }, [batch.id])

  const handleInvite = async () => {
    setInviteError(null)
    if (!inviteEmail.includes('@')) { setInviteError('Please enter a valid email address'); return }
    setInviting(true)
    try {
      const res = await fetch(`/api/projects/${batch.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return }
      setShares((prev) => prev.find((s) => s.email === data.email) ? prev : [...prev, data])
      setInviteEmail('')
    } catch { setInviteError('Failed to invite') } finally { setInviting(false) }
  }

  const handleRevoke = async (email: string) => {
    try {
      await fetch(`/api/projects/${batch.id}/share`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      setShares((prev) => prev.filter((s) => s.email !== email))
    } catch {}
  }

  const handleToggleLink = async () => {
    setTogglingLink(true)
    try {
      if (shareToken) {
        const res = await fetch(`/api/projects/${batch.id}/share-link`, { method: 'DELETE' })
        if (res.ok) { setShareToken(null); onShareTokenChange(batch.id, null) }
      } else {
        const res = await fetch(`/api/projects/${batch.id}/share-link`, { method: 'POST' })
        const data = await res.json()
        if (data.shareToken) { setShareToken(data.shareToken); onShareTokenChange(batch.id, data.shareToken) }
      }
    } catch {} finally { setTogglingLink(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#dde6ea] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dde6ea]">
          <div>
            <h2 className="font-semibold text-[#084c61]">Share Project</h2>
            <p className="text-xs text-[#5a7a85] mt-0.5 truncate max-w-xs">{batch.name}</p>
          </div>
          <button onClick={onClose} className="text-[#8aadb8] hover:text-[#084c61] transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3"><UserPlus className="h-4 w-4 text-[#177e89]" /><h3 className="text-sm font-semibold text-[#084c61]">Invite by email</h3></div>
            <div className="flex gap-2">
              <input type="email" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleInvite()} placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
              <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail}>{inviting ? '…' : 'Add'}</Button>
            </div>
            {inviteError && <p className="text-xs text-rose-500 mt-1.5">{inviteError}</p>}
            {!loadingShares && shares.length > 0 && (
              <ul className="mt-3 space-y-2">
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center justify-between text-sm bg-[#f5f8fa] rounded-lg px-3 py-2">
                    <span className="text-[#084c61]">{share.email}</span>
                    <button onClick={() => handleRevoke(share.email)} className="text-[#8aadb8] hover:text-rose-500 transition-colors"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            {loadingShares && <p className="text-xs text-[#8aadb8] mt-2">Loading…</p>}
            {!loadingShares && shares.length === 0 && <p className="text-xs text-[#8aadb8] mt-2">No one has been invited yet</p>}
          </div>
          <hr className="border-[#dde6ea]" />
          <div>
            <div className="flex items-center gap-2 mb-3"><Link2 className="h-4 w-4 text-[#177e89]" /><h3 className="text-sm font-semibold text-[#084c61]">Shareable link</h3></div>
            <div className="flex items-center justify-between bg-[#f5f8fa] rounded-lg px-4 py-3">
              <div>
                <p className="text-sm text-[#084c61] font-medium">{shareToken ? 'Link sharing enabled' : 'Link sharing disabled'}</p>
                <p className="text-xs text-[#8aadb8] mt-0.5">{shareToken ? 'Anyone with the link can view this project' : 'Enable to share with anyone'}</p>
              </div>
              <button onClick={handleToggleLink} disabled={togglingLink} className={`relative w-10 h-5 rounded-full transition-colors ${shareToken ? 'bg-[#177e89]' : 'bg-[#c5d7de]'}`}>
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${shareToken ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {shareToken && shareUrl && (
              <div className="mt-3 flex gap-2">
                <input readOnly value={shareUrl} className="flex-1 px-3 py-2 text-xs border border-[#dde6ea] rounded-lg bg-[#f5f8fa] text-[#5a7a85] truncate" />
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(shareUrl)}><Check className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({ batchName, onConfirm, onCancel }: { batchName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-[#dde6ea] shadow-xl p-6">
        <h2 className="font-semibold text-[#084c61] mb-2">Delete Project</h2>
        <p className="text-sm text-[#5a7a85] mb-6">
          Are you sure you want to delete <strong className="text-[#084c61]">{batchName}</strong>? This will also delete all prompts and results. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Batch Card ───────────────────────────────────────────────────────────────

function BatchCard({
  batch, running, onRun, onRerun, onRename, onDelete, onShare, onSchedule, onAddPrompt,
}: {
  batch: BatchInfo
  running: string | null
  onRun: (id: string) => void
  onRerun: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onShare: (batch: BatchInfo) => void
  onSchedule: (batch: BatchInfo) => void
  onAddPrompt: (batch: BatchInfo) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState(batch.name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editMode) inputRef.current?.focus() }, [editMode])

  const saveRename = async () => {
    if (!editName.trim() || editName.trim() === batch.name) { setEditMode(false); setEditName(batch.name); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${batch.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName.trim() }) })
      if (res.ok) { onRename(batch.id, editName.trim()); setEditMode(false) }
    } catch {} finally { setSaving(false) }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="flex items-center gap-2 mb-1">
                <input ref={inputRef} value={editName} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setEditMode(false); setEditName(batch.name) } }}
                  className="flex-1 px-2 py-1 text-sm border border-[#084c61] rounded-md focus:outline-none focus:ring-2 focus:ring-[#084c61]" />
                <button onClick={saveRename} disabled={saving} className="text-emerald-600 hover:text-emerald-700 transition-colors"><Check className="h-4 w-4" /></button>
                <button onClick={() => { setEditMode(false); setEditName(batch.name) }} className="text-[#8aadb8] hover:text-[#084c61] transition-colors"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[#084c61] truncate">{batch.name}</h3>
                <button onClick={() => setEditMode(true)} className="text-[#b8cdd3] hover:text-[#177e89] transition-colors shrink-0" title="Rename"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <p className="text-sm text-[#5a7a85]">{batch.fileName}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-[#5a7a85]">{batch._count.prompts} prompts</span>
              {batch.unrunCount > 0 ? (
                <Badge variant="warning">{batch.unrunCount} unrun</Badge>
              ) : (
                <Badge variant="success">All run</Badge>
              )}
              <span className="text-xs text-[#8aadb8]">{new Date(batch.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {batch.unrunCount > 0 ? (
              <Button size="sm" onClick={() => onRun(batch.id)} disabled={running !== null}>
                <Play className="h-3.5 w-3.5 mr-1" />Run
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onRerun(batch.id)} disabled={running !== null} title="Re-run all prompts to capture a new trend snapshot">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Re-run
              </Button>
            )}
            <Link href="/dashboard"><Button variant="outline" size="sm">Results</Button></Link>
            <Link href={`/data/${batch.id}`}><Button variant="outline" size="sm">Data</Button></Link>
            <button onClick={() => onAddPrompt(batch)} className="p-1.5 text-[#b8cdd3] hover:text-[#177e89] transition-colors" title="Add prompt">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={() => onSchedule(batch)} className="p-1.5 text-[#b8cdd3] hover:text-[#177e89] transition-colors" title="Schedule">
              <Calendar className="h-4 w-4" />
            </button>
            <button onClick={() => onShare(batch)} className="p-1.5 text-[#b8cdd3] hover:text-[#177e89] transition-colors" title="Share">
              <Share2 className="h-4 w-4" />
            </button>
            <button onClick={() => onDelete(batch.id)} className="p-1.5 text-[#b8cdd3] hover:text-rose-500 transition-colors" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RunPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [done, setDone] = useState<{ processed: number; errors: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BatchInfo | null>(null)
  const [shareTarget, setShareTarget] = useState<BatchInfo | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<BatchInfo | null>(null)
  const [addPromptTarget, setAddPromptTarget] = useState<BatchInfo | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/batches')
      if (res.ok) setBatches(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetch('/api/batches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setBatches(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => stopPolling(), [])

  const startPolling = useCallback((batchRunId: string) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/run/status?batchRunId=${batchRunId}`)
        if (!res.ok) return
        const status: RunStatus = await res.json()
        const completed = status.doneCount + status.failCount
        setRunStatus(status)
        setProgress(status.totalPrompts > 0 ? Math.round((completed / status.totalPrompts) * 100) : 0)
        if (status.status === 'done') {
          stopPolling()
          setDone({ processed: status.doneCount, errors: status.failCount })
          setRunning(null)
          setRunStatus(null)
          fetchBatches()
        }
      } catch {}
    }, 3000)
  }, [fetchBatches])

  const queueRun = async (batchId?: string, isRerun = false) => {
    const trimmedEmail = notifyEmail.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address'); return
    }
    setEmailError(null)
    setRunning(batchId ?? 'all')
    setProgress(0)
    setRunStatus(null)
    setDone(null)
    setError(null)

    try {
      const res = await fetch('/api/run/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, email: trimmedEmail || undefined, rerun: isRerun }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to queue run')
      if (data.processed === 0 || !data.batchRunId) { setDone({ processed: 0, errors: 0 }); setRunning(null); return }
      startPolling(data.batchRunId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
      setRunning(null)
    }
  }

  const handleRename = (id: string, name: string) => setBatches((prev) => prev.map((b) => b.id === id ? { ...b, name } : b))

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) setBatches((prev) => prev.filter((b) => b.id !== deleteTarget.id))
    } catch {} finally { setDeleteTarget(null) }
  }

  const handleShareTokenChange = (batchId: string, token: string | null) =>
    setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, shareToken: token } : b))

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
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
          {totalUnrun > 0 && (
            <Button onClick={() => queueRun()} disabled={running !== null}>
              <Play className="h-4 w-4 mr-2" />Run All Unrun ({totalUnrun})
            </Button>
          )}
        </div>
      </div>

      {/* Email notification */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-[#177e89]" />
          <p className="text-sm font-semibold text-[#084c61]">Email notification (optional)</p>
        </div>
        <p className="text-xs text-[#5a7a85] mb-3">Prompts run in the background — you can close this tab. Enter your email to get notified when complete.</p>
        <input
          type="email" value={notifyEmail}
          onChange={(e) => { setNotifyEmail(e.target.value); setEmailError(null) }}
          placeholder="you@example.com" disabled={running !== null}
          className="w-full max-w-sm px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] disabled:opacity-50 disabled:bg-[#f5f8fa]"
        />
        {emailError && <p className="text-xs text-rose-500 mt-1.5">{emailError}</p>}
        {notifyEmail.trim() && !emailError && (
          <p className="text-xs text-[#177e89] mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />A summary will be emailed to {notifyEmail.trim()} when the run finishes
          </p>
        )}
      </div>

      {/* Progress */}
      {running !== null && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="h-5 w-5 text-[#177e89] animate-spin" />
              <span className="text-sm font-medium text-[#084c61]">Processing in background — you can close this tab</span>
              <span className="ml-auto text-sm text-[#5a7a85]">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-3" />
            {runStatus && (
              <p className="text-xs text-[#5a7a85]">
                {runStatus.doneCount + runStatus.failCount} / {runStatus.totalPrompts} prompts complete
                {runStatus.failCount > 0 && ` (${runStatus.failCount} errors)`}
              </p>
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
                ? `Ran ${done.processed} prompt${done.processed !== 1 ? 's' : ''} across all 6 platforms${done.errors > 0 ? ` (${done.errors} errors)` : ''}`
                : 'No prompts to run'}
            </p>
            {done.processed > 0 && (
              <Link href="/dashboard" className="text-sm text-emerald-700 underline">View Dashboard →</Link>
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

      {/* Tip about scheduled runs */}
      <div className="flex items-center gap-2 text-xs text-[#8aadb8] mb-4">
        <Clock className="h-3.5 w-3.5" />
        <span>Use the <Calendar className="h-3 w-3 inline" /> calendar icon on each batch to schedule automatic re-runs for trend tracking.</span>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-[#5a7a85]">Loading batches…</CardContent></Card>
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
            <BatchCard
              key={batch.id}
              batch={batch}
              running={running}
              onRun={(id) => queueRun(id)}
              onRerun={(id) => queueRun(id, true)}
              onRename={handleRename}
              onDelete={(id) => setDeleteTarget(batches.find((b) => b.id === id) ?? null)}
              onShare={(b) => setShareTarget(b)}
              onSchedule={(b) => setScheduleTarget(b)}
              onAddPrompt={(b) => setAddPromptTarget(b)}
            />
          ))}
        </div>
      )}

      {deleteTarget && <DeleteConfirmDialog batchName={deleteTarget.name} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}
      {shareTarget && <ShareModal batch={shareTarget} onClose={() => setShareTarget(null)} onShareTokenChange={handleShareTokenChange} />}
      {scheduleTarget && <ScheduleModal batch={scheduleTarget} onClose={() => setScheduleTarget(null)} />}
      {addPromptTarget && <AddPromptModal batch={addPromptTarget} onClose={() => setAddPromptTarget(null)} onAdded={fetchBatches} />}
    </div>
  )
}
