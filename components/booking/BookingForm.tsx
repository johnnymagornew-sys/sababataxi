'use client'

import { useState, useEffect } from 'react'
import AddressAutocomplete from './AddressAutocomplete'
import { calculatePrice } from '@/lib/pricing'
import { getTierIndex, getTierBasePrice, TIER_LABELS, TIER_PRICES } from '@/lib/tierPrices'
import type { BookingExtras } from '@/types/database'

// Normalize Nominatim city names to match our price table
const CITY_NAME_MAP: Record<string, string> = {
  'תל אביב-יפו': 'תל אביב',
  'תל-אביב-יפו': 'תל אביב',
  'קרית גת': 'קריית גת',
  'קרית אונו': 'קריית אונו',
  'קרית ים': 'קריית ים',
  'קרית ביאליק': 'קריית ביאליק',
  'קרית מוצקין': 'קריית מוצקין',
  'קרית אתא': 'קריית אתא',
  'קרית מלאכי': 'קריית מלאכי',
  'ביתר עלית': 'ביתר עילית',
  'מודיעין-מכבים-רעות': 'מודיעין',
  'מודיעין מכבים רעות': 'מודיעין',
  'נצרת עלית': 'נצרת עילית',
  'נוף הגליל': 'נצרת עילית',
  'אריאל (עיר)': 'אריאל',
}
function normalizeCity(city: string): string {
  // Nominatim uses Hebrew maqaf (U+05BE) and en-dash (U+2013) in city names
  // Normalize all dash variants to a regular hyphen before lookup
  const normalized = city
    .replace(/\u05be/g, '-')   // Hebrew maqaf ‑
    .replace(/\u2013/g, '-')   // en-dash –
    .replace(/\u2014/g, '-')   // em-dash —
  return CITY_NAME_MAP[normalized] || CITY_NAME_MAP[city] || normalized
}

// Prices based on stars-taxi.co.il 2026 price list
const CITY_PRICES: Record<string, number> = {
  // ── מרכז – גוש דן ──
  'שוהם': 100,
  'לוד': 100, 'רמלה': 100,
  'יהוד': 110, 'יהוד-מונוסון': 110,
  'אור יהודה': 120,
  'אזור': 125, 'אלעד': 125,
  'גני תקווה': 130, 'רמת אפעל': 130, 'סביון': 130, 'ראש העין': 130,
  'פתח תקווה': 135, 'חולון': 135, 'ראשון לציון': 135,
  'קריית אונו': 135, 'רמות מאיר': 135,
  'רמת גן': 140, 'גבעתיים': 140, 'בני ברק': 140,
  'גבעת שמואל': 140, 'גני הדר': 140, 'נען': 140, 'באר יעקב': 140,
  'תל אביב': 145, 'יפו': 145, 'בת ים': 145,
  'רחובות': 145, 'נס ציונה': 145, 'מודיעין': 145, 'מודיעין עילית': 145,
  'קריית עקרון': 145,
  'גבעת ברנר': 155,
  'גני יוחנן': 160, 'מזכרת בתיה': 160, 'יטיץ': 160,
  'גליה': 165, 'אריאל': 165,
  // ── שרון ──
  'הוד השרון': 170, 'הרצליה': 170, 'רמת השרון': 170,
  'יבנה': 170, 'כפר הנגיד': 170, 'כרמי יוסף': 170, 'בית אלעזרי': 170,
  'כפר סבא': 175, 'רעננה': 175, 'קדרון': 175,
  'אלפי מנשה': 175, 'קדומים': 175, 'מתן': 175,
  'גדרה': 180, 'בית גמליאל': 180, 'משמר דוד': 180,
  'חולדה': 190, 'תל שחר': 190, 'גדרות': 190,
  'כפר יונה': 200, 'עמנואל': 165,
  'נתניה': 245, 'אור עקיבא': 300,
  'גן יבנה': 210,
  'עמק חפר': 260, 'קלנסווה': 260, 'טייבה': 260, 'טירה': 260,
  'פרדס חנה': 310, 'בנימינה': 330,
  'חדרה': 300, 'זכרון יעקב': 350, 'קיסריה': 320,
  'קדימה': 240,
  // ── ירושלים ──
  'ירושלים': 240,
  'בית שמש': 220, 'ביתר עילית': 220,
  'גבעת זאב': 250,
  'מעלה אדומים': 300, 'אפרת': 260,
  // ── דרום ──
  'אשדוד': 230, 'קריית מלאכי': 230,
  'קריית גת': 275,
  'אשקלון': 300,
  'שדרות': 340, 'נתיבות': 360,
  'אופקים': 400, 'באר שבע': 400,
  'ערד': 500, 'דימונה': 540,
  'ים המלח': 700,
  'אילת': 1300,
  // ── צפון – קריות וחיפה ──
  'חיפה': 400, 'נשר': 400,
  'קריית ים': 410, 'קריית ביאליק': 410,
  'קריית מוצקין': 410, 'קריית אתא': 410,
  'טירת כרמל': 390,
  'עכו': 440,
  'נהריה': 490, 'כרמיאל': 480,
  'כפר יסיף': 450,
  // ── גליל ועמקים ──
  'נצרת': 420, 'נצרת עילית': 420,
  'עפולה': 400, 'יוקנעם': 380, 'מגדל העמק': 390,
  'בית שאן': 450,
  'טבריה': 500, 'צפת': 630, 'קצרין': 550,
  'קריית שמונה': 700,
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
  const [addressDisplay, setAddressDisplay] = useState('')
  const [price, setPrice] = useState<{ total: number; tierBase: number; vehicle: string; range: string; inTable: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Live price calculation using exact tier table
  useEffect(() => {
    const fallbackBase = CITY_PRICES[form.pickup_city]
    if (!fallbackBase && !form.pickup_city) { setPrice(null); return }
    if (!fallbackBase) { setPrice(null); return }

    const idx = getTierIndex(form.passengers)
    const tierBase = getTierBasePrice(form.pickup_city, form.passengers, fallbackBase)
    const { vehicle, range } = TIER_LABELS[idx]
    const inTable = !!(TIER_PRICES[form.pickup_city])

    if (!form.travel_date || !form.travel_time) {
      setPrice({ total: tierBase, tierBase, vehicle, range, inTable })
      return
    }
    const { total } = calculatePrice({
      city: form.pickup_city,
      basePrice: fallbackBase,
      passengers: form.passengers,
      travelDate: form.travel_date,
      travelTime: form.travel_time,
      extras: form.extras,
      paymentMethod: form.payment_method,
    })
    setPrice({ total, tierBase, vehicle, range, inTable })
  }, [form.pickup_city, form.passengers, form.travel_date, form.travel_time, form.extras, form.payment_method])

  function handleAddressSelect(parsed: { city: string; street: string; houseNumber: string; displayName: string }) {
    const city = normalizeCity(parsed.city)
    setAddressDisplay(parsed.displayName)
    setField('pickup_city', city)
    setField('pickup_street', parsed.street)
    setField('pickup_house_number', parsed.houseNumber)
  }

  function handleAddressClear() {
    setField('pickup_city', '')
    setField('pickup_street', '')
    setField('pickup_house_number', '')
  }

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
    if (!form.pickup_city && !addressDisplay) { setError('נא להזין כתובת איסוף'); return }
    if (!form.pickup_city) { setError('נא לבחור כתובת מהרשימה'); return }
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
          onClick={() => { setForm(initialForm); setAddressDisplay(''); setSubmitted(false) }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                🚗 {price.vehicle}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', marginTop: 1 }}>
                {price.range}
              </div>
            </div>
          </div>
          {form.passengers > 4 && (
            <div style={{
              display: 'flex', gap: 6, fontSize: 12, flexWrap: 'wrap',
              borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 8, marginTop: 8,
              color: 'rgba(0,0,0,0.6)',
            }}>
              <span>מחיר עבור {price.vehicle} ({price.range}): ₪{price.tierBase}</span>
              {!price.inTable && <span style={{ color: '#c0392b' }}>· הערכה</span>}
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
        {/* Address autocomplete (OpenStreetMap) */}
        <Field label="כתובת איסוף *">
          <AddressAutocomplete
            value={addressDisplay}
            onSelect={handleAddressSelect}
            onClear={handleAddressClear}
          />
        </Field>
        {/* Show parsed breakdown */}
        {form.pickup_city && (
          <div style={{
            marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap',
            fontSize: 12, color: 'var(--txt2)',
          }}>
            <span style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px' }}>
              📍 {form.pickup_city}
            </span>
            {form.pickup_street && (
              <span style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px' }}>
                🛣 {form.pickup_street} {form.pickup_house_number}
              </span>
            )}
            {CITY_PRICES[form.pickup_city] ? (
              <span style={{ background: 'rgba(255,209,0,0.1)', border: '1px solid rgba(255,209,0,0.3)', borderRadius: 6, padding: '3px 10px', color: 'var(--y)' }}>
                מחיר בסיס: ₪{CITY_PRICES[form.pickup_city]}
              </span>
            ) : (
              <span style={{ background: 'rgba(255,150,0,0.1)', border: '1px solid rgba(255,150,0,0.3)', borderRadius: 6, padding: '3px 10px', color: '#FFA500', fontSize: 11 }}>
                עיר לא ברשימה — מחיר יתואם בטלפון
              </span>
            )}
          </div>
        )}

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
