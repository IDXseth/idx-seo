'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'signin' | 'register'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (tab === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to create account')
          setLoading(false)
          return
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#084c61] mb-4 shadow-lg">
            <span className="text-white font-bold text-lg tracking-tight select-none">SL</span>
          </div>
          <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
            Senior Lifestyle
          </h1>
          <p className="text-sm text-[#5a7a85] mt-1">AI Visibility Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#dde6ea] shadow-sm overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-[#dde6ea]">
            <button
              onClick={() => { setTab('signin'); setError(null) }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === 'signin'
                  ? 'text-[#084c61] border-b-2 border-[#084c61] bg-white'
                  : 'text-[#5a7a85] hover:text-[#084c61] bg-[#f5f8fa]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(null) }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === 'register'
                  ? 'text-[#084c61] border-b-2 border-[#084c61] bg-white'
                  : 'text-[#5a7a85] hover:text-[#084c61] bg-[#f5f8fa]'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="p-6">
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[#dde6ea] rounded-lg text-sm font-medium text-[#1a1a1a] bg-white hover:bg-[#f5f8fa] transition-colors mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#dde6ea]" />
              </div>
              <div className="relative flex justify-center text-xs text-[#8aadb8] bg-white px-3">
                or
              </div>
            </div>

            <form onSubmit={handleCredentials} className="space-y-4">
              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-[#084c61] mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 text-sm border border-[#dde6ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#084c61] focus:border-transparent"
                  />
                </div>
              )}

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

              <div>
                <label className="block text-xs font-semibold text-[#084c61] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'register' ? 'At least 6 characters' : '••••••••'}
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
                {loading
                  ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (tab === 'signin' ? 'Sign in' : 'Create account')}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-[#8aadb8] mt-6">
          {tab === 'signin'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <button
            onClick={() => { setTab(tab === 'signin' ? 'register' : 'signin'); setError(null) }}
            className="text-[#177e89] font-semibold hover:underline"
          >
            {tab === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
