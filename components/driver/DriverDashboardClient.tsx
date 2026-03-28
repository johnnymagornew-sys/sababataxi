'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking, Driver } from '@/types/database'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין', approved: 'זמין', claimed: 'שלי',
  completed: 'הושלם', rejected: 'נדחה', cancelled: 'בוטל',
}

export default function DriverDashboardClient({ driver: initialDriver }: { driver: Driver }) {
  const [driver, setDriver] = useState<Driver>(initialDriver)
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [availableRides, setAvailableRides] = useState<Booking[]>([])
  const [myRides, setMyRides] = useState<Booking[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const loadRides = useCallback(async () => {
    const [availRes, mineRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('status', 'approved')
        .order('travel_date', { ascending: true })
        .order('travel_time', { ascending: true }),
      supabase
        .from('bookings')
        .select('*')
        .eq('driver_id', driver.id)
        .in('status', ['claimed', 'completed'])
        .order('travel_date', { ascending: false }),
    ])
    if (availRes.data) setAvailableRides(availRes.data as Booking[])
    if (mineRes.data) setMyRides(mineRes.data as Booking[])
  }, [driver.id, supabase])

  useEffect(() => {
    loadRides()

    // Realtime: watch for new approved bookings
    const channel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: 'status=eq.approved',
      }, () => loadRides())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadRides, supabase])

  async function refreshDriver() {
    const { data } = await supabase.from('drivers').select('*').eq('id', driver.id).single()
    if (data) setDriver(data as Driver)
  }

  async function claimRide(bookingId: string) {
    setClaiming(bookingId)
    const { data, error } = await supabase.rpc('reserve_ride', {
      p_booking_id: bookingId,
      p_driver_id: driver.id,
    })
    setClaiming(null)
    if (error || !data?.success) {
      setMsg({ text: data?.error ?? 'שגיאה בשריון', type: 'err' })
    } else {
      setMsg({ text: `הנסיעה שורינה! עמלה: ₪${data.commission ?? 0}`, type: 'ok' })
      await Promise.all([loadRides(), refreshDriver()])
      setTab('mine')
    }
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isSubActive = driver.subscription_active

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'var(--black)',
        padding: '0 20px',
        height: 60,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, height: 60, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <Image src="/sababa_logo.png" alt="מוניות סבבה" width={200} height={200} style={{ height: 140, width: 'auto', marginTop: -40, marginBottom: -40 }} />
        </button>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: 14 }}
        >
          יציאה
        </button>
      </div>

      <div style={{ padding: '16px 16px 80px' }}>
        {/* Driver Info Card */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px',
          marginBottom: 16,
          display: 'flex',
          gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--y)', color: 'var(--black)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 20, flexShrink: 0,
          }}>
            {driver.full_name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{driver.full_name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge
                label={isSubActive ? 'מנוי פעיל' : 'מנוי לא פעיל'}
                color={isSubActive ? 'var(--green)' : 'var(--red)'}
              />
              <StatusBadge label={`קרדיט: ₪${driver.credits}`} color="var(--y)" />
            </div>
          </div>
        </div>

        {/* Subscription warning */}
        {!isSubActive && (
          <div style={{
            background: 'rgba(231,76,60,0.1)',
            border: '1px solid rgba(231,76,60,0.3)',
            borderRadius: 10, padding: '12px 16px',
            color: '#E74C3C', fontSize: 14, marginBottom: 16,
          }}>
            המנוי שלך אינו פעיל. צור קשר עם האדמין להפעלה.
          </div>
        )}

        {/* Toast message */}
        {msg && (
          <div style={{
            background: msg.type === 'ok' ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(39,174,96,0.3)' : 'rgba(231,76,60,0.3)'}`,
            borderRadius: 10, padding: '10px 16px',
            color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
            fontSize: 14, marginBottom: 16, fontWeight: 600,
          }}>
            {msg.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 16,
          gap: 4,
        }}>
          {([['available', 'נסיעות זמינות', availableRides.length], ['mine', 'הנסיעות שלי', myRides.length]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1,
                background: tab === key ? 'var(--y)' : 'transparent',
                color: tab === key ? 'var(--black)' : 'var(--txt2)',
                border: 'none', borderRadius: 7,
                padding: '10px 8px',
                cursor: 'pointer', fontWeight: 700,
                fontSize: 14, transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  background: tab === key ? 'rgba(0,0,0,0.15)' : 'var(--card2)',
                  color: tab === key ? 'var(--black)' : 'var(--txt)',
                  fontSize: 11, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 10,
                  marginRight: 6,
                }}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Ride list */}
        {tab === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {availableRides.length === 0 ? (
              <EmptyState icon="🔍" text="אין נסיעות זמינות כרגע" />
            ) : (
              availableRides.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  driverId={driver.id}
                  driverCredits={driver.credits}
                  isSubscribed={isSubActive}
                  claiming={claiming === ride.id}
                  onClaim={() => claimRide(ride.id)}
                />
              ))
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {myRides.length === 0 ? (
              <EmptyState icon="🚕" text="עוד לא שריינת נסיעות" />
            ) : (
              myRides.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  driverId={driver.id}
                  driverCredits={driver.credits}
                  isSubscribed={isSubActive}
                  claiming={false}
                  showStatus
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── RideCard ─────────────────────────────────────────────────────

function RideCard({ ride, driverId, driverCredits, isSubscribed, claiming, onClaim, showStatus }: {
  ride: Booking
  driverId: string
  driverCredits: number
  isSubscribed: boolean
  claiming: boolean
  onClaim?: () => void
  showStatus?: boolean
}) {
  const commission = getCommission(ride.price)
  const canClaim = isSubscribed && driverCredits >= commission && ride.status === 'approved'

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '16px',
      transition: 'border-color 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--txt)' }}>
            {ride.pickup_city}
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>
            {ride.pickup_street} {ride.pickup_house_number}
          </div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--y)' }}>₪{ride.price}</div>
          {showStatus && (
            <StatusBadge
              label={STATUS_LABELS[ride.status] ?? ride.status}
              color={ride.status === 'completed' ? 'var(--green)' : 'var(--blue)'}
            />
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 12,
      }}>
        <MetaItem icon="📅" label={formatDate(ride.travel_date)} />
        <MetaItem icon="⏰" label={ride.travel_time.slice(0, 5)} />
        <MetaItem icon="👥" label={`${ride.passengers} נוסעים`} />
        <MetaItem icon="💼" label={`${ride.large_luggage + ride.trolley} מזוודות`} />
      </div>

      {/* Return trip */}
      {ride.return_trip && (
        <div style={{
          background: 'var(--y-dim)', border: '1px solid rgba(255,209,0,0.2)',
          borderRadius: 8, padding: '6px 10px',
          fontSize: 13, color: 'var(--y)', marginBottom: 12,
        }}>
          ✈️ כולל חזרה מהשדה
        </div>
      )}

      {/* Claim section */}
      {onClaim && (
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--txt2)' }}>עמלה: </span>
            <span style={{ color: commission > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
              {commission > 0 ? `−₪${commission}` : 'ללא עמלה'}
            </span>
          </div>
          <button
            className="btn-yellow"
            style={{ padding: '8px 20px', fontSize: 14, borderRadius: 8 }}
            disabled={!canClaim || claiming}
            onClick={onClaim}
          >
            {claiming ? '...' : 'שריין נסיעה'}
          </button>
        </div>
      )}
    </div>
  )
}

function MetaItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--txt2)' }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}22`, color,
      fontSize: 12, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      border: `1px solid ${color}44`,
      display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--txt2)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16 }}>{text}</div>
    </div>
  )
}

function getCommission(price: number): number {
  if (price < 100) return 0
  if (price < 300) return 20
  if (price < 400) return 30
  return 30 + Math.floor((price - 300) / 100) * 10
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' })
}
