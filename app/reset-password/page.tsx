'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('This reset link is missing a token. Please request a new one.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setDone(true)
      setLoading(false)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sl-logo.png" alt="Senior Lifestyle" className="w-64 h-auto object-contain mb-3 rounded-xl p-4" style={{ backgroundColor: '#084c61' }} />
          <p className="text-sm text-[#5a7a85] font-medium">AI Visibility Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#dde6ea] shadow-sm overflow-hidden">
          <div className="p-6">
            <h1 className="text-lg font-semibold text-[#084c61] mb-1.5">Set a new password</h1>

            {done ? (
              <p className="text-sm text-[#5a7a85] leading-relaxed">
                Your password has been reset. Redirecting you to sign in…
              </p>
            ) : !token ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-xs text-rose-600">
                  This reset link is invalid. Please request a new one from the{' '}
                  <Link href="/forgot-password" className="font-semibold hover:underline">
                    forgot password
                  </Link>{' '}
                  page.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#084c61] mb-1.5">
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#084c61] mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <p className="text-xs text-rose-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#084c61] hover:bg-[#054166] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#8aadb8] mt-6">
          <Link href="/login" className="text-[#177e89] font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
