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

type RideStatus = 'en_route' | 'arrived' | 'onboard' | 'done' | null

const RIDE_STATUS_STEPS: { key: RideStatus; label: string; icon: string; next: RideStatus }[] = [
  { key: null,       label: 'יצאתי לנסיעה',      icon: '🚗', next: 'en_route' },
  { key: 'en_route', label: 'הגעתי למקום',        icon: '📍', next: 'arrived'  },
  { key: 'arrived',  label: 'אספתי נוסעים — יוצאים!', icon: '✅', next: 'onboard'  },
  { key: 'onboard',  label: 'נסיעה הסתיימה',      icon: '🏁', next: 'done'     },
]

export default function DriverDashboardClient({ driver: initialDriver }: { driver: Driver }) {
  const [driver, setDriver] = useState<Driver>(initialDriver)
  const [tab, setTab] = useState<'available' | 'mine' | 'history'>('available')
  const [availableRides, setAvailableRides] = useState<Booking[]>([])
  const [myRides, setMyRides] = useState<Booking[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [updatingRideStatus, setUpdatingRideStatus] = useState<string | null>(null)
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

  async function cancelRide(bookingId: string, travelDate: string, travelTime: string) {
    const rideDateTime = new Date(`${travelDate}T${travelTime}`)
    const diffMs = rideDateTime.getTime() - Date.now()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours <= 1) {
      setMsg({ text: 'לא ניתן לבטל פחות משעה לפני הנסיעה. פנה למנהל.', type: 'err' })
      setTimeout(() => setMsg(null), 5000)
      return
    }

    const { data, error } = await supabase.rpc('release_ride', {
      p_booking_id: bookingId,
      p_driver_id: driver.id,
    })
    if (error || !data?.success) {
      setMsg({ text: data?.error ?? 'שגיאה בביטול', type: 'err' })
    } else {
      const refund = data.refund ?? 0
      setMsg({ text: `הנסיעה בוטלה${refund > 0 ? ` • קרדיט הוחזר: ₪${refund}` : ''}`, type: 'ok' })
      await Promise.all([loadRides(), refreshDriver()])
    }
    setTimeout(() => setMsg(null), 5000)
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
      // Notify customer by email
      fetch('/api/driver/notify-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, driverId: driver.id }),
      }).catch(() => {})
    }
    setTimeout(() => setMsg(null), 4000)
  }

  async function updateRideStatus(bookingId: string, nextStatus: RideStatus) {
    setUpdatingRideStatus(bookingId)
    try {
      const res = await fetch('/api/driver/ride-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, ride_status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ text: data.error ?? 'שגיאה בעדכון', type: 'err' })
      } else {
        setMsg({ text: nextStatus === 'done' ? '🏁 נסיעה הסתיימה!' : '✅ סטטוס עודכן', type: 'ok' })
        await loadRides()
      }
    } catch {
      setMsg({ text: 'שגיאת רשת', type: 'err' })
    }
    setUpdatingRideStatus(null)
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isSubActive = driver.subscription_active

  // Split my rides: active (< 45 min after ride time) vs history
  const now = new Date()
  const HISTORY_CUTOFF_MS = 45 * 60 * 1000
  const activeMyRides = myRides.filter(r => {
    const rideTime = new Date(`${r.travel_date}T${r.travel_time}`)
    return now.getTime() - rideTime.getTime() < HISTORY_CUTOFF_MS
  })
  const historyRides = myRides.filter(r => {
    const rideTime = new Date(`${r.travel_date}T${r.travel_time}`)
    return now.getTime() - rideTime.getTime() >= HISTORY_CUTOFF_MS
  })

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
        <button onClick={() => { loadRides(); refreshDriver(); router.refresh() }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, height: 60, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
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
          {([['available', 'זמינות', availableRides.length], ['mine', 'שלי', activeMyRides.length], ['history', 'היסטוריה', historyRides.length]] as const).map(([key, label, count]) => (
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
              availableRides.map(ride => {
                const conflict = myRides.filter(r => r.status === 'claimed').some(r => {
                  const existing = new Date(`${r.travel_date}T${r.travel_time}`)
                  const candidate = new Date(`${ride.travel_date}T${ride.travel_time}`)
                  return Math.abs(existing.getTime() - candidate.getTime()) < 60 * 60 * 1000
                })
                return (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    driverId={driver.id}
                    driverCredits={driver.credits}
                    isSubscribed={isSubActive}
                    claiming={claiming === ride.id}
                    timeConflict={conflict}
                    onClaim={() => claimRide(ride.id)}
                  />
                )
              })
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeMyRides.length === 0 ? (
              <EmptyState icon="🚕" text="אין נסיעות פעילות" />
            ) : (
              activeMyRides.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  driverId={driver.id}
                  driverCredits={driver.credits}
                  isSubscribed={isSubActive}
                  claiming={false}
                  showStatus
                  onCancel={ride.status === 'claimed' ? () => cancelRide(ride.id, ride.travel_date, ride.travel_time) : undefined}
                  onUpdateRideStatus={ride.status === 'claimed' ? (next) => updateRideStatus(ride.id, next) : undefined}
                  updatingRideStatus={updatingRideStatus === ride.id}
                />
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {historyRides.length === 0 ? (
              <EmptyState icon="📋" text="אין היסטוריית נסיעות" />
            ) : (
              historyRides.map(ride => (
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

function RideCard({ ride, driverId, driverCredits, isSubscribed, claiming, onClaim, onCancel, showStatus, timeConflict, onUpdateRideStatus, updatingRideStatus }: {
  ride: Booking
  driverId: string
  driverCredits: number
  isSubscribed: boolean
  claiming: boolean
  onClaim?: () => void
  onCancel?: () => void
  showStatus?: boolean
  timeConflict?: boolean
  onUpdateRideStatus?: (next: RideStatus) => void
  updatingRideStatus?: boolean
}) {
  const commission = getCommission(ride.price)
  const canClaim = isSubscribed && driverCredits >= commission && ride.status === 'approved' && !timeConflict

  const isClaimed = !!showStatus // after claiming → show full details

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${isClaimed ? 'rgba(255,209,0,0.2)' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '16px',
      transition: 'border-color 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--txt)' }}>
            {ride.pickup_city} ← בן גוריון
          </div>
          {isClaimed ? (
            <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>
              {ride.pickup_street} {ride.pickup_house_number}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4, opacity: 0.5 }}>
              🔒 כתובת מלאה תוצג לאחר שריון
            </div>
          )}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--y)' }}>₪{ride.price}</div>
          {isClaimed && (
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
        <MetaItem icon="💼" label={`${(ride.large_luggage ?? 0) + (ride.trolley ?? 0)} מזוודות`} />
      </div>

      {/* Full details — only after claiming */}
      {isClaimed && (
        <div style={{
          background: 'var(--card2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 12, color: 'var(--y)', fontWeight: 700, marginBottom: 4 }}>פרטי לקוח</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{ride.customer_name}</div>
          <div style={{ fontSize: 14, color: 'var(--txt2)', direction: 'ltr', textAlign: 'right' }}>{ride.customer_phone}</div>
          {ride.customer_email && (
            <div style={{ fontSize: 13, color: 'var(--txt2)' }}>{ride.customer_email}</div>
          )}
          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
            <a
              href={`tel:${ride.customer_phone.replace(/\s/g, '')}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'rgba(39,174,96,0.12)', border: '1px solid rgba(39,174,96,0.3)',
                borderRadius: 10, padding: '10px 6px', textDecoration: 'none',
                color: 'var(--green)', fontSize: 11, fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 22 }}>📞</span>
              התקשר
            </a>
            <a
              href={`https://wa.me/${toWhatsAppNumber(ride.customer_phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)',
                borderRadius: 10, padding: '10px 6px', textDecoration: 'none',
                color: '#25D366', fontSize: 11, fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 22 }}>💬</span>
              וואטסאפ
            </a>
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(buildWazeAddress(ride))}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'rgba(0,165,255,0.12)', border: '1px solid rgba(0,165,255,0.3)',
                borderRadius: 10, padding: '10px 6px', textDecoration: 'none',
                color: '#00A5FF', fontSize: 11, fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 22 }}>🗺️</span>
              וויז
            </a>
          </div>
        </div>
      )}

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

      {/* Admin notes */}
      {ride.admin_notes && (
        <div style={{
          background: 'rgba(255,209,0,0.08)', border: '1px solid rgba(255,209,0,0.25)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 12,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📋</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--y)', marginBottom: 3 }}>הערת מנהל</div>
            <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.5 }}>{ride.admin_notes}</div>
          </div>
        </div>
      )}

      {/* Ride status progression — only within 30 min of ride time */}
      {onUpdateRideStatus && ride.status === 'claimed' && (() => {
        const rideMs = new Date(`${ride.travel_date}T${ride.travel_time}`).getTime()
        const diffMin = (rideMs - Date.now()) / 60000
        const currentRideStatus = (ride as Booking & { ride_status?: RideStatus }).ride_status ?? null
        const alreadyStarted = currentRideStatus !== null
        if (!alreadyStarted && diffMin > 30) {
          const rideTimeStr = ride.travel_time.slice(0, 5)
          const openAt = new Date(rideMs - 30 * 60000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
          return (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
                  ⏳ עדכון נסיעה יפתח בשעה <strong style={{ color: 'var(--txt)' }}>{openAt}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, opacity: 0.7 }}>
                  30 דקות לפני הנסיעה ({rideTimeStr})
                </div>
              </div>
            </div>
          )
        }
        return null
      })()}
      {onUpdateRideStatus && ride.status === 'claimed' && (() => {
        const rideMs = new Date(`${ride.travel_date}T${ride.travel_time}`).getTime()
        const diffMin = (rideMs - Date.now()) / 60000
        const currentRideStatus = (ride as Booking & { ride_status?: RideStatus }).ride_status ?? null
        const alreadyStarted = currentRideStatus !== null
        if (!alreadyStarted && diffMin > 30) return null
        return (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
            עדכון סטטוס נסיעה
          </div>
          {(() => {
            const currentRideStatus = (ride as Booking & { ride_status?: RideStatus }).ride_status ?? null
            const currentStep = currentRideStatus !== null
              ? RIDE_STATUS_STEPS.find(s => s.key === currentRideStatus)
              : null
            const nextStep = currentStep
              ? RIDE_STATUS_STEPS.find(s => s.key === currentStep.next)
              : RIDE_STATUS_STEPS[0]

            if (!nextStep) return (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--txt3)', padding: '8px 0' }}>
                ✅ הנסיעה עודכנה
              </div>
            )

            // Show mini progress + next button
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Mini step indicators */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {RIDE_STATUS_STEPS.map((step, i) => {
                    const stepKeys = [null, 'en_route', 'arrived', 'onboard'] as RideStatus[]
                    const stepDone = stepKeys.indexOf(currentRideStatus) >= i || currentRideStatus === step.key
                    return (
                      <div key={step.next ?? 'done'} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        <div style={{
                          flex: 1, height: 3, borderRadius: 99,
                          background: stepDone ? 'var(--y)' : 'var(--border)',
                          transition: 'background 0.3s',
                        }} />
                        {i === RIDE_STATUS_STEPS.length - 1 && (
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: currentRideStatus === 'done' ? 'var(--y)' : 'var(--border)',
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Next action button */}
                <button
                  onClick={() => onUpdateRideStatus(nextStep.next)}
                  disabled={updatingRideStatus}
                  style={{
                    width: '100%', padding: '12px',
                    borderRadius: 10, border: 'none',
                    background: nextStep.next === 'done' ? 'rgba(39,174,96,0.15)' : 'var(--y)',
                    color: nextStep.next === 'done' ? '#27AE60' : '#000',
                    fontWeight: 800, fontSize: 15,
                    cursor: updatingRideStatus ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    outline: nextStep.next === 'done' ? '1px solid rgba(39,174,96,0.3)' : 'none',
                    opacity: updatingRideStatus ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  } as React.CSSProperties}
                >
                  <span style={{ fontSize: 18 }}>{nextStep.icon}</span>
                  {updatingRideStatus ? '...' : nextStep.label}
                </button>
              </div>
            )
          })()}
        </div>
        )
      })()}

      {/* Cancel button — only for claimed rides */}
      {onCancel && (
        <div style={{ paddingTop: 10, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              width: '100%', padding: '10px', borderRadius: 8,
              background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
              color: '#E74C3C', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✗ בטל שריון והחזר קרדיט
          </button>
        </div>
      )}

      {/* Claim section */}
      {onClaim && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {timeConflict ? (
            <div style={{
              background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)',
              borderRadius: 8, padding: '10px 12px',
              color: '#E74C3C', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              ⏱ יש לך נסיעה בהפרש של פחות משעה
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Israeli local: starts with 0 → replace with 972
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  // Already international digits (user typed +XX...)
  return digits
}

function buildWazeAddress(ride: Booking): string {
  const isFromAirport = ride.pickup_city === 'נמל תעופה בן גוריון'
  if (isFromAirport) return ride.destination ?? ''
  return [ride.pickup_street, ride.pickup_house_number, ride.pickup_city].filter(Boolean).join(' ')
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
