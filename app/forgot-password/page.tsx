'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setSent(true)
      setLoading(false)
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
            <h1 className="text-lg font-semibold text-[#084c61] mb-1.5">Reset your password</h1>

            {sent ? (
              <p className="text-sm text-[#5a7a85] leading-relaxed">
                If an account exists for <strong className="text-[#084c61]">{email}</strong>, we&apos;ve sent a
                link to reset your password. The link expires in 1 hour.
              </p>
            ) : (
              <>
                <p className="text-sm text-[#5a7a85] mb-5 leading-relaxed">
                  Enter your account email and we&apos;ll send you a link to reset your password.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#084c61] mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
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
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              </>
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
