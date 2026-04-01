import BookingForm from '@/components/booking/BookingForm'
import OnboardingModal from '@/components/OnboardingModal'
import Link from 'next/link'
import LogoRefreshButton from '@/components/LogoRefreshButton'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <OnboardingModal />
      {/* Header */}
      <header style={{
        background: 'var(--black)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60,
        }}>
          <LogoRefreshButton />
          <Link href="/login" style={{
            background: 'var(--card)',
            color: 'var(--txt2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}>
            כניסה לנהגים
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,209,0,0.07) 0%, transparent 100%)',
        padding: '40px 20px 28px',
        textAlign: 'center',
      }}>
        {/* Badge row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <span style={{
            background: 'var(--y-dim)', border: '1px solid rgba(255,209,0,0.25)',
            borderRadius: 20, padding: '4px 14px', fontSize: 13, color: 'var(--y)', fontWeight: 600,
          }}>✈️ נתב״ג</span>
          <span style={{
            background: 'var(--y-dim)', border: '1px solid rgba(255,209,0,0.25)',
            borderRadius: 20, padding: '4px 14px', fontSize: 13, color: 'var(--y)', fontWeight: 600,
          }}>🚗 מעיר לעיר</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 40px)',
          fontWeight: 800,
          color: 'var(--txt)',
          margin: '0 0 10px',
          letterSpacing: '-1px',
          lineHeight: 1.2,
        }}>
          מוניות לנתב״ג ונסיעות בין עירוניות
        </h1>
        <p style={{ color: 'var(--txt2)', fontSize: 16, margin: '0 0 20px', lineHeight: 1.6 }}>
          מחיר קבוע מראש • ללא הפתעות • נהגים מקצועיים ואדיבים
        </p>

        {/* Feature chips */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          {[
            { icon: '💳', text: 'ללא פרטי אשראי', sub: 'תשלום ישירות לנהג' },
            { icon: '⏱️', text: 'הגעה בזמן', sub: 'ראש שקט ללא דאגות' },
            { icon: '⭐', text: 'שירות אמין ואדיב', sub: 'נהגים מנוסים' },
          ].map(({ icon, text, sub }) => (
            <div key={text} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '8px 14px',
            }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{text}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Form */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 60px' }}>
        <BookingForm />
      </div>
    </div>
  )
}
