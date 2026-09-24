'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminPage() {
  const [status, setStatus] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function runBackfill() {
    setRunning(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/fix-cited-flag', { method: 'POST' })
      const data = await res.json()
      if (data.updated === 0) {
        setStatus('Nothing to fix — all records already correct.')
      } else {
        setStatus(`Done. Updated ${data.updated} result${data.updated === 1 ? '' : 's'} to isCited=true.`)
      }
    } catch {
      setStatus('Request failed. Check the browser console for details.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="max-w-lg mx-auto mt-20 px-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h1 className="text-lg font-semibold">Backfill: Fix isCited Flag</h1>
          <p className="text-sm text-muted-foreground">
            Finds all results where <code>isCited=false</code> but a{' '}
            <code>seniorlifestyle.com</code> citation URL exists, and updates them to{' '}
            <code>isCited=true</code>.
          </p>
          <Button onClick={runBackfill} disabled={running}>
            {running ? 'Running…' : 'Run Backfill'}
          </Button>
          {status && (
            <p className="text-sm font-medium">{status}</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
