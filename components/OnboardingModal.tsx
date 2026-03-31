'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  {
    emoji: '📋',
    color: '#FFD100',
    glow: 'rgba(255,209,0,0.18)',
    badge: 'שלב 1 מתוך 3',
    title: 'ממלאים פרטים בשניות',
    desc: 'מזינים כתובת, בוחרים תאריך ושעה — ומקבלים מחיר סופי וקבוע מיד על המסך.',
    features: null,
  },
  {
    emoji: '🚖',
    color: '#60A5FA',
    glow: 'rgba(96,165,250,0.18)',
    badge: 'שלב 2 מתוך 3',
    title: 'נהג מקצועי מאשר',
    desc: 'נהג מוסמך ומנוסה רואה את ההזמנה ומאשר אותה. תקבלו אישור ישירות.',
    features: null,
  },
  {
    emoji: '✈️',
    color: '#34D399',
    glow: 'rgba(52,211,153,0.18)',
    badge: 'שלב 3 מתוך 3',
    title: 'מגיעים בזמן, בראש שקט',
    desc: 'מחיר ידוע מראש, שירות אקסקלוסיבי ומחירים מוזלים — בלי הפתעות.',
    features: [
      { icon: '💰', text: 'מחיר קבוע מראש' },
      { icon: '⭐', text: 'שירות אקסקלוסיבי' },
      { icon: '🎯', text: 'הגעה מדויקת בזמן' },
      { icon: '🔒', text: 'ללא עלויות נסתרות' },
    ],
  },
]

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [sliding, setSliding] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('sababa_onboarding_never')) setVisible(true)
  }, [])

  function close() {
    setVisible(false)
  }

  function neverShow() {
    localStorage.setItem('sababa_onboarding_never', '1')
    setVisible(false)
  }

  function next() {
    if (step === STEPS.length - 1) { close(); return }
    setSliding(true)
    setTimeout(() => { setStep(s => s + 1); setSliding(false) }, 260)
  }

  if (!visible) return null

  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      <style>{`
        @keyframes sb-fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes sb-rise {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sb-slide {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sb-icon-pop {
          0%   { transform: scale(0.6) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.12) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes sb-ring {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes sb-feature-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sb-content-in {
          animation: sb-slide 0.28s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .sb-feature-item {
          animation: sb-feature-in 0.35s ease forwards;
        }
        .sb-feature-item:nth-child(1) { animation-delay: 0.08s; opacity: 0; }
        .sb-feature-item:nth-child(2) { animation-delay: 0.16s; opacity: 0; }
        .sb-feature-item:nth-child(3) { animation-delay: 0.24s; opacity: 0; }
        .sb-feature-item:nth-child(4) { animation-delay: 0.32s; opacity: 0; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          animation: 'sb-fadeIn 0.2s ease',
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            width: '100%', maxWidth: 420,
            overflow: 'hidden',
            animation: 'sb-rise 0.35s cubic-bezier(0.22,1,0.36,1)',
            boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px ${s.glow}`,
            transition: 'box-shadow 0.4s ease',
          }}
        >
          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 0',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.8px',
              color: s.color, textTransform: 'uppercase',
              transition: 'color 0.3s',
            }}>
              {s.badge}
            </span>
            <button
              onClick={close}
              style={{
                background: 'var(--card2)', border: '1px solid var(--border)',
                borderRadius: '50%', width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--txt2)', fontSize: 16, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* Icon area */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '36px 0 28px',
            position: 'relative',
          }}>
            {/* Glow ring */}
            <div style={{
              position: 'absolute',
              width: 100, height: 100,
              borderRadius: '50%',
              background: s.glow,
              animation: 'sb-ring 1.8s ease-out infinite',
            }} />
            {/* Icon */}
            <div
              key={step}
              style={{
                fontSize: 70, lineHeight: 1,
                animation: 'sb-icon-pop 0.5s cubic-bezier(0.22,1,0.36,1)',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
                position: 'relative', zIndex: 1,
              }}
            >
              {s.emoji}
            </div>
          </div>

          {/* Content */}
          <div
            key={`content-${step}`}
            className={!sliding ? 'sb-content-in' : ''}
            style={{ padding: '0 28px 28px', opacity: sliding ? 0 : 1, transition: 'opacity 0.1s' }}
          >
            <h2 style={{
              fontSize: 22, fontWeight: 800, color: 'var(--txt)',
              margin: '0 0 10px', lineHeight: 1.3, textAlign: 'center',
            }}>
              {s.title}
            </h2>
            <p style={{
              fontSize: 15, color: 'var(--txt2)', margin: '0 0 24px',
              lineHeight: 1.65, textAlign: 'center',
            }}>
              {s.desc}
            </p>

            {/* Features grid (last slide only) */}
            {s.features && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24,
              }}>
                {s.features.map((f, i) => (
                  <div
                    key={i}
                    className="sb-feature-item"
                    style={{
                      background: 'var(--card2)',
                      border: `1px solid ${s.glow}`,
                      borderRadius: 12, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', lineHeight: 1.3 }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={next}
              style={{
                width: '100%', padding: '15px 24px',
                background: s.color,
                border: 'none', borderRadius: 14,
                fontSize: 16, fontWeight: 800, color: '#000',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'transform 0.12s, box-shadow 0.2s',
                boxShadow: `0 4px 20px ${s.glow}`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${s.glow}`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${s.glow}`
              }}
            >
              {isLast ? 'יאללה, נסע!' : 'הבא'}
              <span style={{
                background: 'rgba(0,0,0,0.15)', borderRadius: '50%',
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                {isLast ? '🚀' : '←'}
              </span>
            </button>

            {/* Skip / Never show */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              {!isLast ? (
                <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: 13, cursor: 'pointer', padding: '6px' }}>
                  דלג
                </button>
              ) : <span />}
              <button onClick={neverShow} style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: 12, cursor: 'pointer', padding: '6px', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                אל תראה שוב
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div style={{
            display: 'flex', gap: 6, justifyContent: 'center',
            paddingBottom: 20,
          }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 5, borderRadius: 99,
                  background: i === step ? s.color : 'var(--border)',
                  width: i === step ? 24 : 8,
                  transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
