'use client'

import { useState, useEffect, useRef } from 'react'
import { CITIES } from '@/lib/cities'
import { calculatePrice, getPassengerTier } from '@/lib/pricing'
import type { BookingExtras } from '@/types/database'

const CITY_PRICES: Record<string, number> = {
  'תל אביב': 145, 'רמת גן': 145, 'גבעתיים': 145, 'בני ברק': 145,
  'פתח תקווה': 120, 'ראשון לציון': 120, 'רחובות': 120, 'נס ציונה': 120,
  'לוד': 100, 'רמלה': 100, 'שוהם': 100, 'יהוד': 90,
  'קריית אונו': 110, 'אור יהודה': 100, 'אזור': 100,
  'בת ים': 140, 'חולון': 135,
  'הרצליה': 155, 'רעננה': 155, 'כפר סבא': 155,
  'הוד השרון': 150, 'נתניה': 175, 'ראש העין': 130,
  'אלעד': 125, 'מודיעין': 130, 'מודיעין עילית': 130,
  'רמת השרון': 150, 'כפר יונה': 155, 'אור עקיבא': 195,
  'טייבה': 145, 'קלנסווה': 145, 'טירה': 145,
  'חדרה': 200, 'זכרון יעקב': 220, 'פרדס חנה': 210, 'בנימינה': 210,
  'עמק חפר': 200,
  'ירושלים': 240, 'בית שמש': 200, 'מעלה אדומים': 260,
  'גבעת זאב': 250, 'ביתר עילית': 220, 'אפרת': 260,
  'באר שבע': 340, 'אשדוד': 180, 'אשקלון': 210, 'קריית גת': 220,
  'קריית מלאכי': 230, 'גדרה': 160, 'יבנה': 150, 'נתיבות': 280,
  'שדרות': 270, 'אילת': 800,
  'חיפה': 400, 'קריית ים': 400, 'קריית ביאליק': 390,
  'קריית מוצקין': 390, 'קריית אתא': 395, 'נשר': 400,
  'טירת כרמל': 390, 'עכו': 440, 'נהריה': 460, 'כרמיאל': 420,
  'נצרת': 400, 'נצרת עילית': 400, 'עפולה': 380, 'בית שאן': 420,
  'טבריה': 430, 'צפת': 470, 'קצרין': 500, 'יוקנעם': 380,
  'כפר יסיף': 440, 'מגדל העמק': 380,
  'אריאל': 160, 'אלפי מנשה': 165, 'עמנואל': 155, 'קדומים': 165,
}

interface FormData {
  customer_name: string
  customer_phone: string
  customer_email: string
  pickup_city: string
  pickup_street: string
  pickup_house_number: string
  travel_date: string
  travel_time: string
  passengers: number
  large_luggage: number
  trolley: number
  return_trip: boolean
  return_address: string
  return_flight_number: string
  return_date: string
  return_time: string
  payment_method: 'cash' | 'bit'
  special_requests: string
  extras: BookingExtras
}

const initialForm: FormData = {
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  pickup_city: '',
  pickup_street: '',
  pickup_house_number: '',
  travel_date: '',
  travel_time: '',
  passengers: 1,
  large_luggage: 0,
  trolley: 0,
  return_trip: false,
  return_address: '',
  return_flight_number: '',
  return_date: '',
  return_time: '',
  payment_method: 'cash',
  special_requests: '',
  extras: {},
}

export default function BookingForm() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [cityQuery, setCityQuery] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [price, setPrice] = useState<{ total: number; base: number; tier: string; multiplier: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const cityRef = useRef<HTMLDivElement>(null)

  const filteredCities = CITIES.filter(c =>
    c.includes(cityQuery) || cityQuery === ''
  ).slice(0, 8)

  // Live price calculation
  useEffect(() => {
    const base = CITY_PRICES[form.pickup_city]
    if (!base) { setPrice(null); return }
    const { label: tier, multiplier } = getPassengerTier(form.passengers)
    if (!form.travel_date || !form.travel_time) {
      const adjustedBase = Math.round(base * multiplier)
      setPrice({ total: adjustedBase, base, tier, multiplier })
      return
    }
    const { total } = calculatePrice({
      basePrice: base,
      passengers: form.passengers,
      travelDate: form.travel_date,
      travelTime: form.travel_time,
      extras: form.extras,
      paymentMethod: form.payment_method,
    })
    setPrice({ total, base, tier, multiplier })
  }, [form.pickup_city, form.passengers, form.travel_date, form.travel_time, form.extras, form.payment_method])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setExtra(key: keyof BookingExtras, value: boolean) {
    setForm(prev => ({ ...prev, extras: { ...prev.extras, [key]: value } }))
  }

  function stepChange(key: 'passengers' | 'large_luggage' | 'trolley', delta: number) {
    setForm(prev => ({
      ...prev,
      [key]: Math.max(key === 'passengers' ? 1 : 0, (prev[key] as number) + delta)
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pickup_city) { setError('נא לבחור ישוב'); return }
    if (!form.travel_date || !form.travel_time) { setError('נא למלא תאריך ושעה'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: price?.total ?? 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחה')
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחה')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginTop: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', color: 'var(--txt)' }}>
          ההזמנה התקבלה!
        </h2>
        <p style={{ color: 'var(--txt2)', fontSize: 16, margin: '0 0 8px' }}>
          תאשר איתך בקרוב טלפונית.
        </p>
        {form.customer_email && (
          <p style={{ color: 'var(--txt2)', fontSize: 14 }}>
            אישור ישלח ל: {form.customer_email}
          </p>
        )}
        <button
          className="btn-yellow"
          style={{ margin: '24px auto 0', maxWidth: 200 }}
          onClick={() => { setForm(initialForm); setCityQuery(''); setSubmitted(false) }}
        >
          הזמנה חדשה
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
      {/* Price Card */}
      {price && (
        <div style={{
          background: 'var(--y)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: price.multiplier > 1 ? 10 : 0 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.6)', marginBottom: 2 }}>
                מחיר משוער
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--black)', lineHeight: 1 }}>
                ₪{price.total}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', textAlign: 'left' }}>
              {form.pickup_city && <div>{form.pickup_city} → בן גוריון</div>}
              <div style={{ fontWeight: 700, color: 'rgba(0,0,0,0.7)', marginTop: 2 }}>
                🚗 {price.tier}
              </div>
            </div>
          </div>
          {price.multiplier > 1 && (
            <div style={{
              display: 'flex', gap: 8, fontSize: 12,
              borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 8,
              color: 'rgba(0,0,0,0.6)',
            }}>
              <span>בסיס: ₪{price.base}</span>
              <span>×</span>
              <span style={{ fontWeight: 700 }}>{price.multiplier} ({form.passengers} נוסעים)</span>
              <span>=</span>
              <span style={{ fontWeight: 700 }}>₪{Math.round(price.base * price.multiplier)}</span>
            </div>
          )}
        </div>
      )}

      {/* Section: פרטים אישיים */}
      <Section title="פרטים אישיים">
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="שם מלא *">
            <input
              type="text" required placeholder="ישראל ישראלי"
              value={form.customer_name}
              onChange={e => setField('customer_name', e.target.value)}
            />
          </Field>
          <Field label="טלפון *">
            <input
              type="tel" required placeholder="050-0000000"
              value={form.customer_phone}
              onChange={e => setField('customer_phone', e.target.value)}
              dir="ltr" style={{ textAlign: 'right' }}
            />
          </Field>
          <Field label="אימייל (אופציונלי)">
            <input
              type="email" placeholder="your@email.com"
              value={form.customer_email}
              onChange={e => setField('customer_email', e.target.value)}
              dir="ltr" style={{ textAlign: 'right' }}
            />
          </Field>
        </div>
      </Section>

      {/* Section: פרטי נסיעה */}
      <Section title="פרטי נסיעה">
        {/* City autocomplete */}
        <Field label="ישוב / עיר *">
          <div ref={cityRef} style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="הקלד שם עיר..."
              value={cityQuery || form.pickup_city}
              onChange={e => {
                setCityQuery(e.target.value)
                setField('pickup_city', '')
                setShowCityDropdown(true)
              }}
              onFocus={() => setShowCityDropdown(true)}
              required={!form.pickup_city}
            />
            {showCityDropdown && filteredCities.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, left: 0,
                background: 'var(--card2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                zIndex: 10,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                marginTop: 4,
              }}>
                {filteredCities.map(city => (
                  <div
                    key={city}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: 15,
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.1s',
                    }}
                    onMouseDown={() => {
                      setField('pickup_city', city)
                      setCityQuery(city)
                      setShowCityDropdown(false)
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {city}
                    {CITY_PRICES[city] && (
                      <span style={{ color: 'var(--y)', fontSize: 13, marginRight: 8 }}>
                        ₪{CITY_PRICES[city]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '2fr 1fr', marginTop: 14 }}>
          <Field label="רחוב *">
            <input
              type="text" required placeholder="שם הרחוב"
              value={form.pickup_street}
              onChange={e => setField('pickup_street', e.target.value)}
            />
          </Field>
          <Field label="מספר בית *">
            <input
              type="text" required placeholder="5"
              value={form.pickup_house_number}
              onChange={e => setField('pickup_house_number', e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
          <Field label="תאריך נסיעה *">
            <input
              type="date" required
              min={new Date().toISOString().split('T')[0]}
              value={form.travel_date}
              onChange={e => setField('travel_date', e.target.value)}
            />
          </Field>
          <Field label="שעת נסיעה *">
            <input
              type="time" required
              value={form.travel_time}
              onChange={e => setField('travel_time', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Section: נוסעים ומטען */}
      <Section title="נוסעים ומטען">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Stepper label="נוסעים" value={form.passengers} min={1}
            onChange={d => stepChange('passengers', d)} />
          <Stepper label="מזוודות" value={form.large_luggage} min={0}
            onChange={d => stepChange('large_luggage', d)} />
          <Stepper label="טרולי" value={form.trolley} min={0}
            onChange={d => stepChange('trolley', d)} />
        </div>
      </Section>

      {/* Section: תוספות */}
      <Section title="תוספות שירות">
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <ExtraCheck
            label="נקודה נוספת באותו ישוב"
            sub="+₪20"
            checked={!!form.extras.additional_stop}
            onChange={v => setExtra('additional_stop', v)}
          />
          <ExtraCheck
            label="נקודה נוספת בישוב סמוך"
            sub="+₪40"
            checked={!!form.extras.nearby_city_stop}
            onChange={v => setExtra('nearby_city_stop', v)}
          />
          <ExtraCheck
            label="ילד עד גיל 4"
            sub="+₪10"
            checked={!!form.extras.child_under4}
            onChange={v => setExtra('child_under4', v)}
          />
          <ExtraCheck
            label="כיסא בטיחות"
            sub="+₪40–70 (תיאום)"
            checked={!!form.extras.safety_seat}
            onChange={v => setExtra('safety_seat', v)}
          />
          <ExtraCheck
            label="ציוד סקי / גלישה"
            sub="+₪20"
            checked={!!form.extras.ski_equipment}
            onChange={v => setExtra('ski_equipment', v)}
          />
          <ExtraCheck
            label="ארגז אופניים"
            sub="+₪50"
            checked={!!form.extras.bike_rack}
            onChange={v => setExtra('bike_rack', v)}
          />
        </div>
      </Section>

      {/* Section: חזרה */}
      <Section title="נסיעת חזרה">
        <label style={{
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', userSelect: 'none',
          background: form.return_trip ? 'var(--y-dim)' : 'var(--card2)',
          border: `1px solid ${form.return_trip ? 'rgba(255,209,0,0.3)' : 'var(--border)'}`,
          borderRadius: 10, padding: '12px 16px',
          transition: 'all 0.15s',
        }}>
          <input
            type="checkbox"
            checked={form.return_trip}
            onChange={e => setField('return_trip', e.target.checked)}
            style={{ width: 'auto', accentColor: 'var(--y)' }}
          />
          <span style={{ fontWeight: 600, color: 'var(--txt)' }}>
            אני צריך גם חזרה מהשדה
          </span>
        </label>
        {form.return_trip && (
          <div style={{ marginTop: 14, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Field label="כתובת חזרה">
              <input
                type="text" placeholder="רחוב ועיר"
                value={form.return_address}
                onChange={e => setField('return_address', e.target.value)}
              />
            </Field>
            <Field label="מספר טיסה">
              <input
                type="text" placeholder="LY123"
                value={form.return_flight_number}
                onChange={e => setField('return_flight_number', e.target.value)}
                dir="ltr" style={{ textAlign: 'right' }}
              />
            </Field>
            <Field label="תאריך חזרה">
              <input
                type="date"
                value={form.return_date}
                onChange={e => setField('return_date', e.target.value)}
              />
            </Field>
            <Field label="שעה משוערת">
              <input
                type="time"
                value={form.return_time}
                onChange={e => setField('return_time', e.target.value)}
              />
            </Field>
          </div>
        )}
      </Section>

      {/* Section: תשלום */}
      <Section title="אמצעי תשלום">
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <PayMethod
            label="מזומן" icon="💵"
            selected={form.payment_method === 'cash'}
            onClick={() => setField('payment_method', 'cash')}
          />
          <PayMethod
            label="ביט" icon="📱" sub="+₪10"
            selected={form.payment_method === 'bit'}
            onClick={() => setField('payment_method', 'bit')}
          />
        </div>
      </Section>

      {/* Special requests */}
      <div style={{ marginBottom: 20 }}>
        <label>הערות מיוחדות</label>
        <textarea
          rows={3}
          placeholder="בקשות מיוחדות, הנחיות גישה וכד'..."
          value={form.special_requests}
          onChange={e => setField('special_requests', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>

      {error && (
        <div style={{
          background: 'rgba(231,76,60,0.1)',
          border: '1px solid rgba(231,76,60,0.3)',
          borderRadius: 8, padding: '10px 14px',
          color: '#E74C3C', fontSize: 14, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <button type="submit" className="btn-yellow" style={{ width: '100%', fontSize: 18, padding: '16px' }} disabled={submitting}>
        {submitting ? 'שולח...' : (
          <>
            {price ? `הזמן עכשיו – ₪${price.total}` : 'הזמן עכשיו'}
            <span style={{
              background: 'rgba(0,0,0,0.15)', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>→</span>
          </>
        )}
      </button>
    </form>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      {children}
    </div>
  )
}

function Stepper({ label, value, min, onChange }: {
  label: string; value: number; min: number; onChange: (delta: number) => void
}) {
  return (
    <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 8px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 8, fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <button
          type="button"
          onClick={() => onChange(-1)}
          disabled={value <= min}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
            color: 'var(--txt)', fontSize: 18, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >−</button>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--txt)', minWidth: 20, textAlign: 'center' }}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(1)}
          style={{
            background: 'var(--y)', border: 'none',
            borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
            color: 'var(--black)', fontSize: 18, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, flexShrink: 0,
          }}
        >+</button>
      </div>
    </div>
  )
}

function ExtraCheck({ label, sub, checked, onChange }: {
  label: string; sub: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      background: checked ? 'var(--y-dim)' : 'var(--card2)',
      border: `1px solid ${checked ? 'rgba(255,209,0,0.3)' : 'var(--border)'}`,
      borderRadius: 8, padding: '10px 12px',
      transition: 'all 0.15s', userSelect: 'none',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 'auto', accentColor: 'var(--y)', flexShrink: 0 }}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--y)' }}>{sub}</div>
      </div>
    </label>
  )
}

function PayMethod({ label, icon, sub, selected, onClick }: {
  label: string; icon: string; sub?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? 'var(--y-dim)' : 'var(--card2)',
        border: `2px solid ${selected ? 'var(--y)' : 'var(--border)'}`,
        borderRadius: 10, padding: '14px 16px',
        cursor: 'pointer', textAlign: 'center',
        transition: 'all 0.15s', width: '100%',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: selected ? 'var(--y)' : 'var(--txt)', fontSize: 16 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>{sub}</div>}
    </button>
  )
}
