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

      {/* Booking Form */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 60px' }}>
        <BookingForm />
      </div>
    </div>
  )
}
