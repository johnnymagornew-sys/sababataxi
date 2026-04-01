import { createClient } from '@supabase/supabase-js'
import TrackingClient from './TrackingClient'
import Link from 'next/link'
import Image from 'next/image'

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, ride_status,
      pickup_city, pickup_street, pickup_house_number,
      destination, travel_date, travel_time, passengers,
      driver_id, drivers (full_name)
    `)
    .eq('tracking_token', token)
    .single()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', direction: 'rtl' }}>
      {/* Header */}
      <header style={{
        background: 'var(--black)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', height: 60 }}>
          <Image src="/sababa_logo.png" alt="מוניות סבבה" width={200} height={200}
            style={{ height: 140, width: 'auto', marginTop: -40, marginBottom: -40 }} />
        </Link>
        <span style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 600 }}>מעקב נסיעה</span>
      </header>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 60px' }}>
        {error || !data ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)', margin: '0 0 8px' }}>
              נסיעה לא נמצאה
            </h2>
            <p style={{ color: 'var(--txt3)', fontSize: 14 }}>
              הקישור אינו תקף או שהנסיעה לא קיימת
            </p>
          </div>
        ) : (
          <TrackingClient
            bookingId={data.id}
            token={token}
            initialStatus={data.status}
            initialRideStatus={data.ride_status}
            pickupCity={data.pickup_city}
            pickupStreet={data.pickup_street}
            pickupHouseNumber={data.pickup_house_number}
            destination={data.destination}
            travelDate={data.travel_date}
            travelTime={data.travel_time}
            passengers={data.passengers}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            driverFirstName={data.driver_id ? ((data as any).drivers?.full_name?.split(' ')[0] ?? null) : null}
          />
        )}
      </div>
    </div>
  )
}
