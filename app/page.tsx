import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookingForm from '@/components/booking/BookingForm'
import OnboardingModal from '@/components/OnboardingModal'
import Link from 'next/link'
import LogoRefreshButton from '@/components/LogoRefreshButton'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { getLocale } from 'next-intl/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    const userId = session.user.id
    const { data: adminRow } = await supabase.from('admins').select('id').eq('user_id', userId).single()
    if (adminRow) redirect('/admin')

    const { data: driverRow } = await supabase.from('drivers').select('id').eq('user_id', userId).single()
    if (driverRow) redirect('/driver/dashboard')
  }

  const locale = await getLocale()
  const isRtl = locale === 'he' || locale === 'ar'
  const driverLoginText = locale === 'en' ? 'Driver Login' : locale === 'ru' ? 'Вход' : locale === 'ar' ? 'دخول' : 'כניסה לנהגים'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <OnboardingModal />
      {/* Header */}
      <header style={{
        background: 'var(--black)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 200,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60,
        }}>
          <LogoRefreshButton />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSwitcher current={locale} />
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
              {driverLoginText}
            </Link>
          </div>
        </div>
      </header>

      {/* Booking Form */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 60px' }}>
        <BookingForm />
      </div>
    </div>
  )
}
