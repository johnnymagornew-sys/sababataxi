'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
      return
    }

    // Check if admin
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', data.user.id)
      .single()

    if (adminRow) {
      router.push('/admin')
      return
    }

    // Check if driver
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id, is_active')
      .eq('user_id', data.user.id)
      .single()

    if (driverRow) {
      router.push('/driver/dashboard')
      return
    }

    setError('המשתמש לא מוגדר כנהג. פנה לאדמין.')
    await supabase.auth.signOut()
    setLoading(false)
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
          <div style={{
            background: 'var(--y)', color: 'var(--black)',
            fontWeight: 800, fontSize: 24,
            padding: '8px 16px', borderRadius: 12,
            display: 'inline-block', marginBottom: 12,
          }}>🚕</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--txt)' }}>
            כניסה לנהגים
          </h1>
          <p style={{ color: 'var(--txt2)', marginTop: 6, fontSize: 14 }}>
            פאנל ניהול נסיעות
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label>אימייל</label>
              <input
                type="email" required
                placeholder="driver@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <label>סיסמה</label>
              <input
                type="password" required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>

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
              {loading ? 'נכנס...' : 'כניסה'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/" style={{ color: 'var(--txt2)', fontSize: 14, textDecoration: 'none' }}>
            ← חזרה לטופס הזמנה
          </Link>
        </div>
      </div>
    </div>
  )
}
