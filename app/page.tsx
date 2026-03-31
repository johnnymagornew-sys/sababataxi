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
        background: 'linear-gradient(180deg, rgba(255,209,0,0.06) 0%, transparent 100%)',
        padding: '48px 20px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          background: 'var(--y-dim)',
          border: '1px solid rgba(255,209,0,0.25)',
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: 13,
          color: 'var(--y)',
          fontWeight: 600,
          marginBottom: 16,
        }}>
          ✈️ שדה תעופה בן גוריון
        </div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: 800,
          color: 'var(--txt)',
          margin: '0 0 12px',
          letterSpacing: '-1px',
          lineHeight: 1.2,
        }}>
          הזמינו מונית לשדה התעופה
        </h1>
        <p style={{ color: 'var(--txt2)', fontSize: 17, margin: 0 }}>
          שירות אמין • מחירים קבועים • ללא הפתעות
        </p>
      </div>

      {/* Booking Form */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 60px' }}>
        <BookingForm />
      </div>
    </div>
  )
}
