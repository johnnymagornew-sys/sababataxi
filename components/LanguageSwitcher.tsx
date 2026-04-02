'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const LANGS = [
  { code: 'he', label: 'עב', name: 'עברית' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ru', label: 'RU', name: 'Русский' },
  { code: 'ar', label: 'عر', name: 'العربية' },
]

export default function LanguageSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false)
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null)
  const router = useRouter()

  async function switchLang(locale: string) {
    await fetch('/api/set-locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    setOpen(false)
    router.refresh()
  }

  const currentLang = LANGS.find(l => l.code === current) ?? LANGS[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { setBtnRect((e.currentTarget as HTMLButtonElement).getBoundingClientRect()); setOpen(o => !o) }}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--txt2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'inherit',
        }}
      >
        🌐 {currentLang.label}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'fixed',
            top: btnRect ? btnRect.bottom + 6 : 0,
            right: btnRect ? window.innerWidth - btnRect.right : 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            zIndex: 100,
            minWidth: 130,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  background: l.code === current ? 'rgba(255,209,0,0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  color: l.code === current ? 'var(--y)' : 'var(--txt)',
                  fontWeight: l.code === current ? 700 : 500,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{l.label}</span>
                <span>{l.name}</span>
                {l.code === current && <span style={{ marginRight: 'auto', marginLeft: 0 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
