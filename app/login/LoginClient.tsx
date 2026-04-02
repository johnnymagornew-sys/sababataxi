'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLocale } from 'next-intl'

export default function LoginClient() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('login')
  const tNav = useTranslations('nav')
  const locale = useLocale()

  // On mount: check for existing session → redirect automatically
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setChecking(false); return }

      await redirectByRole(session.user.id)
      setChecking(false)
    }
    checkSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function redirectByRole(userId: string) {
    const { data: adminRow } = await supabase
      .from('admins').select('id').eq('user_id', userId).single()
    if (adminRow) { router.replace('/admin'); return }

    const { data: driverRow } = await supabase
      .from('drivers').select('id').eq('user_id', userId).single()
    if (driverRow) { router.replace('/driver/dashboard'); return }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Determine email: if identifier looks like an email use it directly, otherwise resolve phone → email
    let email: string
    const isEmail = identifier.includes('@')
    if (isEmail) {
      email = identifier.trim()
    } else {
      const res = await fetch('/api/auth/phone-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: identifier }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json()
        setError(msg || t('errorPhone'))
        setLoading(false)
        return
      }
      const data = await res.json()
      email = data.email
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(t('errorPassword'))
      setLoading(false)
      return
    }

    if (!rememberMe) {
      sessionStorage.setItem('no_persist', '1')
    } else {
      sessionStorage.removeItem('no_persist')
    }

    await redirectByRole(data.user.id)
    setLoading(false)
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--txt2)', fontSize: 15 }}>{t('loading')}</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-block', marginBottom: 16, padding: 0 }}>
            <Image src="/sababa_logo.png" alt="מוניות סבבה" width={200} height={80} style={{ objectFit: 'contain' }} priority />
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
            {t('title')}
          </h1>
          <p style={{ color: 'var(--txt2)', marginTop: 6, fontSize: 14 }}>
            {t('subtitle')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <LanguageSwitcher current={locale} />
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label>{t('phoneEmailLabel')}</label>
              <input
                type="text" required
                placeholder={t('phoneEmailPlaceholder')}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                dir="ltr"
                style={{ textAlign: 'right' }}
                autoComplete="username"
                inputMode="email"
              />
            </div>
            <div>
              <label>{t('passwordLabel')}</label>
              <input
                type="password" required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                dir="ltr"
                autoComplete="current-password"
              />
            </div>

            {/* Remember me */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', userSelect: 'none',
              background: rememberMe ? 'var(--y-dim)' : 'var(--card2)',
              border: `1px solid ${rememberMe ? 'rgba(255,209,0,0.25)' : 'var(--border)'}`,
              borderRadius: 8, padding: '10px 12px',
              transition: 'all 0.15s',
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--y)', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>{t('rememberMe')}</div>
                <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 1 }}>
                  {t('rememberMeSub')}
                </div>
              </div>
            </label>

            {error && (
              <div style={{
                background: 'rgba(231,76,60,0.1)',
                border: '1px solid rgba(231,76,60,0.3)',
                borderRadius: 8, padding: '10px 14px',
                color: '#E74C3C', fontSize: 14,
              }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-yellow" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/" style={{ color: 'var(--txt2)', fontSize: 14, textDecoration: 'none' }}>
            {tNav('backToBooking')}
          </Link>
        </div>
      </div>
    </div>
  )
}
