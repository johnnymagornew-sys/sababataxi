'use client'

import { useState, useEffect, useCallback } from 'react'

type BookingStatus = 'pending' | 'approved' | 'rejected' | 'claimed' | 'completed' | 'cancelled'
type RideStatus = 'en_route' | 'arrived' | 'onboard' | 'done' | null

interface Props {
  bookingId: string
  token: string
  initialStatus: BookingStatus
  initialRideStatus: RideStatus
  pickupCity: string
  pickupStreet: string
  pickupHouseNumber: string
  destination: string
  travelDate: string
  travelTime: string
  passengers: number
  driverFirstName: string | null
}

const STEPS: { key: string; label: string; sublabel: string; icon: string }[] = [
  { key: 'approved',  label: 'ההזמנה אושרה',       sublabel: 'הנסיעה אושרה על ידי המוקד', icon: '✅' },
  { key: 'claimed',   label: 'נהג שובץ',            sublabel: 'נהג שריין את הנסיעה שלך',   icon: '🚕' },
  { key: 'en_route',  label: 'הנהג בדרך אליך',       sublabel: 'הנהג יצא לאסוף אותך',       icon: '🚗' },
  { key: 'arrived',   label: 'הנהג הגיע!',          sublabel: 'הנהג ממתין למטה',            icon: '📍' },
  { key: 'onboard',   label: 'יוצאים לדרך!',        sublabel: 'הנוסעים עלו לרכב',          icon: '🛫' },
  { key: 'done',      label: 'הנסיעה הסתיימה',      sublabel: 'תודה שבחרתם במוניות סבבה',  icon: '🏁' },
]

function getActiveStepIndex(status: BookingStatus, rideStatus: RideStatus): number {
  if (rideStatus === 'done' || status === 'completed') return 5
  if (rideStatus === 'onboard') return 4
  if (rideStatus === 'arrived') return 3
  if (rideStatus === 'en_route') return 2
  if (status === 'claimed') return 1
  if (status === 'approved') return 0
  return -1
}

export default function TrackingClient({
  bookingId, token,
  initialStatus, initialRideStatus,
  pickupCity, pickupStreet, pickupHouseNumber,
  destination, travelDate, travelTime, passengers,
  driverFirstName,
}: Props) {
  const [status, setStatus] = useState<BookingStatus>(initialStatus)
  const [rideStatus, setRideStatus] = useState<RideStatus>(initialRideStatus)
  const [driver, setDriver] = useState<string | null>(driverFirstName)
  const [lastPoll, setLastPoll] = useState(Date.now())

  const activeStep = getActiveStepIndex(status, rideStatus)
  const isCancelled = status === 'cancelled' || status === 'rejected'
  const isPending = status === 'pending'

  const rideMs = new Date(`${travelDate}T${travelTime}`).getTime()
  const diffMin = (rideMs - Date.now()) / 60000
  const trackingLive = rideStatus !== null || diffMin <= 30
  const trackingOpenAt = new Date(rideMs - 30 * 60000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`)
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.status)
      setRideStatus(data.ride_status)
      if (data.driver_first_name) setDriver(data.driver_first_name)
      setLastPoll(Date.now())
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    // Poll every 8 seconds for live updates
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [poll])

  const pickupAddress = pickupStreet
    ? `${pickupStreet} ${pickupHouseNumber}, ${pickupCity}`
    : pickupCity

  const dateStr = new Date(travelDate).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Trip card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '20px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Map decoration */}
        <div style={{ position: 'absolute', top: -24, left: -24, opacity: 0.07, pointerEvents: 'none' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="50" stroke="#FFD700" strokeWidth="1"/>
            <circle cx="60" cy="60" r="35" stroke="#FFD700" strokeWidth="0.8"/>
            <circle cx="60" cy="60" r="20" stroke="#FFD700" strokeWidth="0.6"/>
            <line x1="10" y1="60" x2="110" y2="60" stroke="#FFD700" strokeWidth="0.6"/>
            <line x1="60" y1="10" x2="60" y2="110" stroke="#FFD700" strokeWidth="0.6"/>
          </svg>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Route */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 8px rgba(255,215,0,0.5)' }} />
                <div style={{ width: 1.5, height: 36, background: 'linear-gradient(to bottom, #FFD700, rgba(255,255,255,0.08))', margin: '3px 0' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>נקודת איסוף</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{pickupAddress}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>📍</span>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>יעד</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{destination}</div>
              </div>
            </div>
          </div>

          {/* Date + Time + Passengers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { icon: '📅', value: dateStr },
              { icon: '🕐', value: travelTime.slice(0, 5) },
              { icon: '👥', value: `${passengers} נוסעים` },
            ].map(({ icon, value }) => (
              <div key={value} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', lineHeight: 1.2 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Driver chip */}
      {driver && (
        <div style={{
          background: 'rgba(255,209,0,0.08)',
          border: '1px solid rgba(255,209,0,0.2)',
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--y)', color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 18, flexShrink: 0,
          }}>{driver[0]}</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>הנהג שלך</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{driver}</div>
          </div>
        </div>
      )}

      {/* Status — pending or cancelled */}
      {isPending && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>ממתין לאישור</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>ההזמנה ממתינה לאישור המוקד</div>
        </div>
      )}

      {isCancelled && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>❌</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#E74C3C', marginBottom: 4 }}>הנסיעה בוטלה</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>לפרטים נוספים צור קשר עם המוקד</div>
        </div>
      )}

      {/* Not live yet */}
      {!isPending && !isCancelled && !trackingLive && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 18, padding: '24px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏰</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>
            המעקב החי יפתח בשעה {trackingOpenAt}
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.5 }}>
            30 דקות לפני הנסיעה תוכל לעקוב<br />אחרי הנהג בזמן אמת
          </div>
          <div style={{
            marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,209,0,0.08)', border: '1px solid rgba(255,209,0,0.2)',
            borderRadius: 20, padding: '6px 14px', fontSize: 13, color: 'var(--y)', fontWeight: 600,
          }}>
            ✈️ שעת נסיעה: {travelTime.slice(0, 5)}
          </div>
        </div>
      )}

      {/* Timeline */}
      {!isPending && !isCancelled && trackingLive && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '20px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 16 }}>
            סטטוס נסיעה
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((step, i) => {
              const isDone = i <= activeStep
              const isActive = i === activeStep
              const isLast = i === STEPS.length - 1

              return (
                <div key={step.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isDone ? 15 : 14,
                      background: isDone ? (isActive ? 'var(--y)' : 'rgba(255,209,0,0.2)') : 'var(--card2)',
                      border: `2px solid ${isDone ? 'var(--y)' : 'var(--border)'}`,
                      boxShadow: isActive ? '0 0 0 4px rgba(255,209,0,0.15)' : 'none',
                      transition: 'all 0.4s',
                    }}>
                      {isDone ? (isActive ? step.icon : '✓') : <span style={{ opacity: 0.3 }}>○</span>}
                    </div>
                    {!isLast && (
                      <div style={{
                        width: 2, height: 28,
                        background: i < activeStep ? 'var(--y)' : 'var(--border)',
                        transition: 'background 0.4s',
                        margin: '2px 0',
                      }} />
                    )}
                  </div>

                  {/* Text */}
                  <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 28 }}>
                    <div style={{
                      fontSize: 15, fontWeight: isActive ? 800 : 600,
                      color: isDone ? 'var(--txt)' : 'var(--txt3)',
                      transition: 'color 0.3s',
                      lineHeight: 1.1,
                    }}>
                      {step.label}
                      {isActive && (
                        <span style={{
                          marginRight: 8,
                          display: 'inline-block',
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: '#FFD700',
                          animation: 'pulse-dot 1.5s ease-in-out infinite',
                        }} />
                      )}
                    </div>
                    {isDone && (
                      <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{step.sublabel}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt3)' }}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#27AE60', marginLeft: 5, verticalAlign: 'middle' }} />
        מתעדכן אוטומטית · עדכון אחרון: {new Date(lastPoll).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  )
}
