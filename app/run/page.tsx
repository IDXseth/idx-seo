'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Play, CheckCircle2, AlertCircle, RefreshCw, BarChart3, Circle,
  Mail, Pencil, Trash2, Share2, X, Check, Link2, UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/utils'

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

interface PlatformStatus {
  platform: string
  isMentioned: boolean
  isCited: boolean
  error: string | null
}

interface ProgressEntry {
  processed: number
  total: number
  prompt: string
  community: string
  platformResults: PlatformStatus[]
}

interface ShareEntry {
  id: string
  email: string
  createdAt: string
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
    if (!inviteEmail.includes('@')) {
      setInviteError('Please enter a valid email address')
      return
    }
    setInviting(true)
    try {
      const res = await fetch(`/api/projects/${batch.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error || 'Failed to invite')
        return
      }
      setShares((prev) => {
        if (prev.find((s) => s.email === data.email)) return prev
        return [...prev, data]
      })
      setInviteEmail('')
    } catch {
      setInviteError('Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRevoke = async (email: string) => {
    try {
      await fetch(`/api/projects/${batch.id}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setShares((prev) => prev.filter((s) => s.email !== email))
    } catch {}
  }

  const handleToggleLink = async () => {
    setTogglingLink(true)
    try {
      if (shareToken) {
        // Disable
        const res = await fetch(`/api/projects/${batch.id}/share-link`, { method: 'DELETE' })
        if (res.ok) {
          setShareToken(null)
          onShareTokenChange(batch.id, null)
        }
      } else {
        // Enable
        const res = await fetch(`/api/projects/${batch.id}/share-link`, { method: 'POST' })
        const data = await res.json()
        if (data.shareToken) {
          setShareToken(data.shareToken)
          onShareTokenChange(batch.id, data.shareToken)
        }
      }
    } catch {} finally {
      setTogglingLink(false)
    }
  }

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#dde6ea] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dde6ea]">
          <div>
            <h2 className="font-semibold text-[#084c61]">Share Project</h2>
            <p className="text-xs text-[#5a7a85] mt-0.5 truncate max-w-xs">{batch.name}</p>
          </div>
          <button onClick={onClose} className="text-[#8aadb8] hover:text-[#084c61] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Invite by email */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4 text-[#177e89]" />
              <h3 className="text-sm font-semibold text-[#084c61]">Invite by email</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61]"
              />
              <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail}>
                {inviting ? '…' : 'Add'}
              </Button>
            </div>
            {inviteError && <p className="text-xs text-rose-500 mt-1.5">{inviteError}</p>}

            {/* Shares list */}
            {!loadingShares && shares.length > 0 && (
              <ul className="mt-3 space-y-2">
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center justify-between text-sm bg-[#f5f8fa] rounded-lg px-3 py-2">
                    <span className="text-[#084c61]">{share.email}</span>
                    <button
                      onClick={() => handleRevoke(share.email)}
                      className="text-[#8aadb8] hover:text-rose-500 transition-colors"
                      title="Revoke access"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loadingShares && <p className="text-xs text-[#8aadb8] mt-2">Loading…</p>}
            {!loadingShares && shares.length === 0 && (
              <p className="text-xs text-[#8aadb8] mt-2">No one has been invited yet</p>
            )}
          </div>

          <hr className="border-[#dde6ea]" />

          {/* Share link toggle */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-[#177e89]" />
              <h3 className="text-sm font-semibold text-[#084c61]">Shareable link</h3>
            </div>
            <div className="flex items-center justify-between bg-[#f5f8fa] rounded-lg px-4 py-3">
              <div>
                <p className="text-sm text-[#084c61] font-medium">
                  {shareToken ? 'Link sharing enabled' : 'Link sharing disabled'}
                </p>
                <p className="text-xs text-[#8aadb8] mt-0.5">
                  {shareToken ? 'Anyone with the link can view this project' : 'Enable to share with anyone'}
                </p>
              </div>
              <button
                onClick={handleToggleLink}
                disabled={togglingLink}
                className={`relative w-10 h-5 rounded-full transition-colors ${shareToken ? 'bg-[#177e89]' : 'bg-[#c5d7de]'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${shareToken ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {shareToken && shareUrl && (
              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-xs border border-[#dde6ea] rounded-lg bg-[#f5f8fa] text-[#5a7a85] truncate"
                />
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : 'Copy'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────────
function DeleteConfirmDialog({
  batchName,
  onConfirm,
  onCancel,
}: {
  batchName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-[#dde6ea] shadow-xl p-6">
        <h2 className="font-semibold text-[#084c61] mb-2">Delete Project</h2>
        <p className="text-sm text-[#5a7a85] mb-6">
          Are you sure you want to delete <strong className="text-[#084c61]">{batchName}</strong>?
          This will also delete all prompts and results. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Batch Card ───────────────────────────────────────────────────────────────
function BatchCard({
  batch,
  running,
  onRun,
  onRename,
  onDelete,
  onShare,
}: {
  batch: BatchInfo
  running: string | null
  onRun: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onShare: (batch: BatchInfo) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState(batch.name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editMode) inputRef.current?.focus()
  }, [editMode])

  const saveRename = async () => {
    if (!editName.trim() || editName.trim() === batch.name) {
      setEditMode(false)
      setEditName(batch.name)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (res.ok) {
        onRename(batch.id, editName.trim())
        setEditMode(false)
      }
    } catch {} finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename()
                    if (e.key === 'Escape') { setEditMode(false); setEditName(batch.name) }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-[#084c61] rounded-md focus:outline-none focus:ring-2 focus:ring-[#084c61]"
                />
                <button
                  onClick={saveRename}
                  disabled={saving}
                  className="text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setEditMode(false); setEditName(batch.name) }}
                  className="text-[#8aadb8] hover:text-[#084c61] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[#084c61] truncate">{batch.name}</h3>
                <button
                  onClick={() => setEditMode(true)}
                  className="text-[#b8cdd3] hover:text-[#177e89] transition-colors shrink-0"
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
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
              <span className="text-xs text-[#8aadb8]">
                {new Date(batch.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {batch.unrunCount > 0 && (
              <Button
                size="sm"
                onClick={() => onRun(batch.id)}
                disabled={running !== null}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Run
              </Button>
            )}
            <Link href="/dashboard">
              <Button variant="outline" size="sm">View Results</Button>
            </Link>
            <Link href={`/data/${batch.id}`}>
              <Button variant="outline" size="sm">View Data</Button>
            </Link>
            <button
              onClick={() => onShare(batch)}
              className="p-1.5 text-[#b8cdd3] hover:text-[#177e89] transition-colors"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(batch.id)}
              className="p-1.5 text-[#b8cdd3] hover:text-rose-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function RunPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([])
  const [done, setDone] = useState<{ processed: number; errors: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BatchInfo | null>(null)
  const [shareTarget, setShareTarget] = useState<BatchInfo | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/batches')
      if (res.ok) setBatches(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/batches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setBatches(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progressLog])

  const runPrompts = async (batchId?: string) => {
    const trimmedEmail = notifyEmail.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address')
      return
    }
    setEmailError(null)
    setRunning(batchId ?? 'all')
    setProgress(0)
    setProgressLog([])
    setDone(null)
    setError(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(batchId ? { batchId } : {}),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Run failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'start') {
              setProgress(0)
            } else if (event.type === 'progress') {
              setProgress(Math.round((event.processed / event.total) * 100))
              setProgressLog((prev) => [...prev, event as ProgressEntry])
            } else if (event.type === 'done') {
              setProgress(100)
              setDone({ processed: event.processed, errors: event.errors })
              await fetchBatches()
            }
          } catch {
            // malformed event
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(null)
    }
  }

  const handleRename = (id: string, name: string) => {
    setBatches((prev) => prev.map((b) => b.id === id ? { ...b, name } : b))
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setBatches((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      }
    } catch {} finally {
      setDeleteTarget(null)
    }
  }

  const handleShareTokenChange = (batchId: string, token: string | null) => {
    setBatches((prev) =>
      prev.map((b) => b.id === batchId ? { ...b, shareToken: token } : b)
    )
  }

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
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {totalUnrun > 0 && (
            <Button onClick={() => runPrompts()} disabled={running !== null}>
              <Play className="h-4 w-4 mr-2" />
              Run All Unrun ({totalUnrun})
            </Button>
          )}
        </div>
      </div>

      {/* Email notification input */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-[#177e89]" />
          <p className="text-sm font-semibold text-[#084c61]">Email notification (optional)</p>
        </div>
        <p className="text-xs text-[#5a7a85] mb-3">
          Enter your email to receive a summary when the run completes — useful if you want to close this tab while prompts process in the background.
        </p>
        <input
          type="email"
          value={notifyEmail}
          onChange={(e) => { setNotifyEmail(e.target.value); setEmailError(null) }}
          placeholder="you@example.com"
          disabled={running !== null}
          className="w-full max-w-sm px-3 py-2 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent disabled:opacity-50 disabled:bg-[#f5f8fa]"
        />
        {emailError && (
          <p className="text-xs text-rose-500 mt-1.5">{emailError}</p>
        )}
        {notifyEmail.trim() && !emailError && (
          <p className="text-xs text-[#177e89] mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            A summary will be emailed to {notifyEmail.trim()} when the run finishes
          </p>
        )}
      </div>

      {running !== null && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCw className="h-5 w-5 text-[#177e89] animate-spin" />
              <span className="text-sm font-medium text-[#084c61]">
                Querying AI platforms in real time…
              </span>
              <span className="ml-auto text-sm text-[#5a7a85]">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-4" />

            {progressLog.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {progressLog.map((entry, i) => (
                  <div key={i} className="border border-[#eef3f5] rounded-lg p-2 bg-[#f5f8fa]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[#084c61] truncate max-w-xs">
                        {entry.community}
                      </span>
                      <span className="text-[#8aadb8] ml-2">{entry.processed}/{entry.total}</span>
                    </div>
                    <p className="text-[#5a7a85] truncate mb-1.5">{entry.prompt}</p>
                    <div className="flex flex-wrap gap-1">
                      {entry.platformResults.map(({ platform, isMentioned, isCited, error: pErr }) => (
                        <span
                          key={platform}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${PLATFORM_COLORS[platform]}22`,
                            color: PLATFORM_COLORS[platform],
                          }}
                        >
                          {pErr ? (
                            <AlertCircle className="h-2.5 w-2.5" />
                          ) : isCited ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : isMentioned ? (
                            <Circle className="h-2.5 w-2.5 fill-current" />
                          ) : (
                            <Circle className="h-2.5 w-2.5" />
                          )}
                          {PLATFORM_LABELS[platform]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
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
                ? `Ran ${done.processed} prompt${done.processed !== 1 ? 's' : ''} across all 6 platforms${done.errors > 0 ? ` (${done.errors} platform errors)` : ''}`
                : 'No prompts to run'}
            </p>
            {done.processed > 0 && notifyEmail.trim() && (
              <p className="text-xs text-emerald-600 mt-0.5">Summary email sent to {notifyEmail.trim()}</p>
            )}
            {done.processed > 0 && (
              <Link href="/dashboard" className="text-sm text-emerald-700 underline">
                View Dashboard →
              </Link>
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[#5a7a85] mb-4">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Cited</span>
        <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-[#8aadb8] text-[#8aadb8]" /> Mentioned only</span>
        <span className="flex items-center gap-1"><Circle className="h-3 w-3 text-[#8aadb8]" /> Not mentioned</span>
        <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-rose-400" /> Error</span>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-[#5a7a85]">Loading batches…</CardContent>
        </Card>
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
              onRun={runPrompts}
              onRename={handleRename}
              onDelete={(id) => setDeleteTarget(batches.find((b) => b.id === id) ?? null)}
              onShare={(b) => setShareTarget(b)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          batchName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Share modal */}
      {shareTarget && (
        <ShareModal
          batch={shareTarget}
          onClose={() => setShareTarget(null)}
          onShareTokenChange={handleShareTokenChange}
        />
      )}
    </div>
  )
}
