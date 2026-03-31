'use client'

import { useState, useEffect, useRef } from 'react'
import AddressAutocomplete, { ParsedAddress } from './AddressAutocomplete'
import PhoneInput from './PhoneInput'
import { calculatePrice, getTimeSurcharges } from '@/lib/pricing'
import { getTierIndex, getTierBasePrice, TIER_LABELS, TIER_PRICES } from '@/lib/tierPrices'
import { INTERCITY_PRICES, getIntercityPrice } from '@/lib/intercityPrices'
import type { BookingExtras } from '@/types/database'

// ─── City normalisation ───────────────────────────────────────────
const CITY_NAME_MAP: Record<string, string> = {
  'תל אביב-יפו': 'תל אביב', 'תל-אביב-יפו': 'תל אביב',
  'קרית גת': 'קריית גת', 'קרית אונו': 'קריית אונו',
  'קרית ים': 'קריית ים', 'קרית ביאליק': 'קריית ביאליק',
  'קרית מוצקין': 'קריית מוצקין', 'קרית אתא': 'קריית אתא',
  'קרית מלאכי': 'קריית מלאכי', 'ביתר עלית': 'ביתר עילית',
  'מודיעין-מכבים-רעות': 'מודיעין', 'מודיעין מכבים רעות': 'מודיעין',
  'נצרת עלית': 'נצרת עילית', 'נוף הגליל': 'נצרת עילית', 'אריאל (עיר)': 'אריאל',
}
function normalizeCity(city: string): string {
  const n = city.replace(/\u05be/g, '-').replace(/\u2013/g, '-').replace(/\u2014/g, '-')
  return CITY_NAME_MAP[n] || CITY_NAME_MAP[city] || n
}

// ─── Base prices ──────────────────────────────────────────────────
const CITY_PRICES: Record<string, number> = {
  'שוהם': 100, 'לוד': 100, 'רמלה': 100,
  'יהוד': 110, 'יהוד-מונוסון': 110, 'אור יהודה': 120,
  'אזור': 125, 'אלעד': 125,
  'גני תקווה': 130, 'רמת אפעל': 130, 'סביון': 130, 'ראש העין': 130,
  'פתח תקווה': 135, 'חולון': 135, 'ראשון לציון': 135, 'קריית אונו': 135, 'רמות מאיר': 135,
  'רמת גן': 140, 'גבעתיים': 140, 'בני ברק': 140, 'גבעת שמואל': 140,
  'גני הדר': 140, 'נען': 140, 'באר יעקב': 140,
  'תל אביב': 145, 'יפו': 145, 'בת ים': 145,
  'רחובות': 145, 'נס ציונה': 145, 'מודיעין': 145, 'מודיעין עילית': 145, 'קריית עקרון': 145,
  'גבעת ברנר': 155, 'גני יוחנן': 160, 'מזכרת בתיה': 160, 'יטיץ': 160,
  'גליה': 165, 'אריאל': 165, 'עמנואל': 165,
  'הוד השרון': 170, 'הרצליה': 170, 'רמת השרון': 170,
  'יבנה': 170, 'כפר הנגיד': 170, 'כרמי יוסף': 170, 'בית אלעזרי': 170,
  'כפר סבא': 175, 'רעננה': 175, 'קדרון': 175, 'אלפי מנשה': 175, 'קדומים': 175, 'מתן': 175,
  'גדרה': 180, 'בית גמליאל': 180, 'משמר דוד': 180,
  'חולדה': 190, 'תל שחר': 190, 'גדרות': 190,
  'כפר יונה': 200, 'גן יבנה': 210,
  'ירושלים': 240, 'קדימה': 240,
  'נתניה': 245,
  'בית שמש': 220, 'ביתר עילית': 220,
  'אשדוד': 230, 'קריית מלאכי': 230,
  'גבעת זאב': 250,
  'עמק חפר': 260, 'קלנסווה': 260, 'טייבה': 260, 'טירה': 260, 'אפרת': 260,
  'קריית גת': 275,
  'חדרה': 300, 'אור עקיבא': 300, 'אשקלון': 300, 'מעלה אדומים': 300,
  'קיסריה': 320, 'זכרון יעקב': 350,
  'פרדס חנה': 310, 'בנימינה': 330, 'שדרות': 340, 'נתיבות': 360,
  'יוקנעם': 380, 'טירת כרמל': 390, 'מגדל העמק': 390,
  'אופקים': 400, 'באר שבע': 400, 'חיפה': 400, 'נשר': 400, 'עפולה': 400,
  'קריית ים': 410, 'קריית ביאליק': 410, 'קריית מוצקין': 410, 'קריית אתא': 410,
  'נצרת': 420, 'נצרת עילית': 420, 'עכו': 440, 'כפר יסיף': 450,
  'בית שאן': 450, 'נהריה': 490, 'כרמיאל': 480,
  'טבריה': 500, 'ערד': 500, 'קצרין': 550, 'דימונה': 540, 'צפת': 630,
  'קריית שמונה': 700, 'ים המלח': 700,
  'אילת': 1300,
}

// ─── Types ────────────────────────────────────────────────────────
interface FormData {
  trip_type: 'airport' | 'intercity'
  customer_name: string; customer_phone: string; customer_email: string
  pickup_city: string; pickup_street: string; pickup_house_number: string
  destination_city: string
  destination_street: string
  destination_house_number: string
  travel_date: string; travel_time: string; passengers: number
  large_luggage: number; trolley: number; return_trip: boolean
  return_city: string; return_street: string; return_house_number: string
  return_flight_number: string; return_date: string; return_time: string
  payment_method: 'cash' | 'bit'; special_requests: string; extras: BookingExtras
}
const initialForm: FormData = {
  trip_type: 'airport',
  customer_name: '', customer_phone: '', customer_email: '',
  pickup_city: '', pickup_street: '', pickup_house_number: '',
  destination_city: '',
  destination_street: '',
  destination_house_number: '',
  travel_date: '', travel_time: '', passengers: 1, large_luggage: 0, trolley: 0,
  return_trip: false, return_city: '', return_street: '', return_house_number: '',
  return_flight_number: '', return_date: '', return_time: '',
  payment_method: 'cash', special_requests: '', extras: {},
}

const STEPS = [
  { label: 'פרטים', icon: '👤' },
  { label: 'נסיעה', icon: '✈️' },
  { label: 'נוסעים', icon: '🧳' },
  { label: 'תשלום', icon: '💳' },
]

// ─── Component ────────────────────────────────────────────────────
export default function BookingForm() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [addressDisplay, setAddressDisplay] = useState('')
  const [destinationAddressDisplay, setDestinationAddressDisplay] = useState('')
  const [returnAddressDisplay, setReturnAddressDisplay] = useState('')
  const [price, setPrice] = useState<{ total: number; tierBase: number; vehicle: string; range: string; inTable: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const prevPrice = useRef<number | null>(null)
  const [priceFlash, setPriceFlash] = useState(false)
  const [phoneValid, setPhoneValid] = useState(false)
  // Price calculation
  useEffect(() => {
    const idx = getTierIndex(form.passengers)
    const { vehicle, range } = TIER_LABELS[idx]

    if (form.trip_type === 'intercity') {
      if (!form.pickup_city || !form.destination_city) { setPrice(null); return }
      const basePrice = getIntercityPrice(form.pickup_city, form.destination_city)
      if (!basePrice) { setPrice(null); return }
      let total = basePrice
      if (form.travel_date && form.travel_time) {
        const dateTime = new Date(`${form.travel_date}T${form.travel_time}`)
        const s = getTimeSurcharges(dateTime)
        if (s.night) total += 20
        if (s.peak) total += 20
        if (s.shabbat) total += 15
      }
      if (form.extras.additional_stop) total += 20
      if (form.extras.nearby_city_stop) total += 40
      if (form.extras.child_under4) total += 10
      if (form.extras.safety_seat) total += 55
      if (form.extras.ski_equipment) total += 20
      if (form.extras.bike_rack) total += 50
      if (form.payment_method === 'bit') total += 10
      setPrice({ total, tierBase: basePrice, vehicle, range, inTable: true })
      return
    }

    // Airport trip
    const fallbackBase = CITY_PRICES[form.pickup_city]
    if (!fallbackBase) { setPrice(null); return }
    const tierBase = getTierBasePrice(form.pickup_city, form.passengers, fallbackBase)
    const inTable = !!(TIER_PRICES[form.pickup_city])
    if (!form.travel_date || !form.travel_time) {
      setPrice({ total: tierBase, tierBase, vehicle, range, inTable }); return
    }
    const { total } = calculatePrice({
      city: form.pickup_city, basePrice: fallbackBase, passengers: form.passengers,
      travelDate: form.travel_date, travelTime: form.travel_time,
      extras: form.extras, paymentMethod: form.payment_method,
    })
    setPrice({ total, tierBase, vehicle, range, inTable })
  }, [form.trip_type, form.pickup_city, form.destination_city, form.passengers, form.travel_date, form.travel_time, form.extras, form.payment_method])

  // Flash animation when price changes
  useEffect(() => {
    if (price?.total !== null && price?.total !== prevPrice.current) {
      setPriceFlash(true)
      setTimeout(() => setPriceFlash(false), 600)
      prevPrice.current = price?.total ?? null
    }
  }, [price?.total])

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }
  function setExtra(key: keyof BookingExtras, value: boolean) {
    setForm(prev => ({ ...prev, extras: { ...prev.extras, [key]: value } }))
  }
  function stepChange(key: 'passengers' | 'large_luggage' | 'trolley', delta: number) {
    setForm(prev => ({ ...prev, [key]: Math.max(key === 'passengers' ? 1 : 0, (prev[key] as number) + delta) }))
  }

  function handleAddressSelect(parsed: ParsedAddress) {
    const city = normalizeCity(parsed.city)
    setAddressDisplay(parsed.displayName)
    setField('pickup_city', city)
    setField('pickup_street', parsed.street)
    setField('pickup_house_number', parsed.houseNumber)
  }
  function handleAddressClear() {
    setAddressDisplay('')
    setField('pickup_city', ''); setField('pickup_street', ''); setField('pickup_house_number', '')
  }
  function handleDestinationAddressSelect(parsed: ParsedAddress) {
    const city = normalizeCity(parsed.city)
    setDestinationAddressDisplay(parsed.displayName)
    setField('destination_city', city)
    setField('destination_street', parsed.street)
    setField('destination_house_number', parsed.houseNumber)
  }
  function handleDestinationAddressClear() {
    setDestinationAddressDisplay('')
    setField('destination_city', ''); setField('destination_street', ''); setField('destination_house_number', '')
  }
  function handleReturnAddressSelect(parsed: ParsedAddress) {
    const city = normalizeCity(parsed.city)
    setReturnAddressDisplay(parsed.displayName)
    setField('return_city', city); setField('return_street', parsed.street); setField('return_house_number', parsed.houseNumber)
  }
  function handleReturnAddressClear() {
    setReturnAddressDisplay('')
    setField('return_city', ''); setField('return_street', ''); setField('return_house_number', '')
  }

  function goTo(next: number) {
    setError('')
    setDir(next > step ? 1 : -1)
    setTimeout(() => { setStep(next); setAnimKey(k => k + 1) }, 10)
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.customer_name.trim()) return 'נא להזין שם מלא'
      if (!form.customer_phone.trim()) return 'נא להזין טלפון'
      if (!phoneValid) return 'נא להזין מספר טלפון תקין'
    }
    if (step === 1) {
      if (!form.pickup_city) return 'נא לבחור כתובת מהרשימה'
      if (form.trip_type === 'intercity' && !form.destination_city) return 'נא לבחור עיר יעד'
      if (!form.travel_date) return 'נא לבחור תאריך נסיעה'
      if (!form.travel_time) return 'נא להזין שעת נסיעה'
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    // Save lead when leaving step 0 (personal details filled in)
    if (step === 0) {
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.customer_name,
          phone: form.customer_phone,
          email: form.customer_email,
        }),
      }).catch(() => {}) // fire and forget, don't block UX
    }
    goTo(step + 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  // ── Success screen ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginTop: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', color: 'var(--txt)' }}>ההזמנה התקבלה!</h2>
        <p style={{ color: 'var(--txt2)', fontSize: 16, margin: '0 0 8px' }}>תאשר איתך בקרוב טלפונית.</p>
        {form.customer_email && (
          <p style={{ color: 'var(--txt2)', fontSize: 14 }}>אישור ישלח ל: {form.customer_email}</p>
        )}
        <button className="btn-yellow" style={{ margin: '24px auto 0', maxWidth: 200 }}
          onClick={() => { setForm(initialForm); setAddressDisplay(''); setReturnAddressDisplay(''); setStep(0); setSubmitted(false) }}>
          הזמנה חדשה
        </button>
      </div>
    )
  }

  // ── Wizard ──────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes wiz-in-right { from { opacity:0; transform:translateX(56px) } to { opacity:1; transform:translateX(0) } }
        @keyframes wiz-in-left  { from { opacity:0; transform:translateX(-56px) } to { opacity:1; transform:translateX(0) } }
        @keyframes price-pop    { 0%{transform:scale(1)} 40%{transform:scale(1.1)} 70%{transform:scale(0.97)} 100%{transform:scale(1)} }
        @keyframes price-glow   { 0%{box-shadow:0 0 0 0 rgba(255,209,0,0.5)} 100%{box-shadow:0 0 0 10px rgba(255,209,0,0)} }
        @keyframes field-up     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .wiz-forward { animation: wiz-in-right 0.32s cubic-bezier(0.22,1,0.36,1) both }
        .wiz-back    { animation: wiz-in-left  0.32s cubic-bezier(0.22,1,0.36,1) both }
        .price-flash { animation: price-pop 0.45s ease, price-glow 0.6s ease }
        .field-enter { animation: field-up 0.3s ease both }
        .field-enter:nth-child(1){animation-delay:.04s}
        .field-enter:nth-child(2){animation-delay:.09s}
        .field-enter:nth-child(3){animation-delay:.14s}
        .field-enter:nth-child(4){animation-delay:.19s}
        .field-enter:nth-child(5){animation-delay:.24s}
        .field-enter:nth-child(6){animation-delay:.29s}
        /* Mobile: stack date+time vertically */
        @media (max-width: 480px) {
          .date-time-grid { grid-template-columns: 1fr !important; }
        }
        .date-time-grid > div { min-width: 0; overflow: hidden; }
        /* Custom toggle */
        .toggle-wrap { display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; }
        .toggle-track {
          width:48px; height:28px; border-radius:99px; flex-shrink:0;
          background:var(--card2); border:2px solid var(--border);
          position:relative; transition:background 0.2s, border-color 0.2s;
        }
        .toggle-track.on { background:var(--y); border-color:var(--y); }
        .toggle-thumb {
          position:absolute; top:2px; right:2px;
          width:20px; height:20px; border-radius:50%;
          background:#fff; transition:transform 0.2s cubic-bezier(0.22,1,0.36,1);
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
        }
        .toggle-track.on .toggle-thumb { transform:translateX(-20px); }
      `}</style>

      <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>

        {/* ── Progress bar ─────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: i < step ? 16 : 18,
                  background: i < step ? 'var(--y)' : i === step ? 'var(--y-dim)' : 'var(--card2)',
                  border: `2px solid ${i <= step ? 'var(--y)' : 'var(--border)'}`,
                  color: i < step ? '#000' : i === step ? 'var(--y)' : 'var(--txt3)',
                  fontWeight: 700, transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)',
                  boxShadow: i === step ? '0 0 0 4px rgba(255,209,0,0.12)' : 'none',
                }}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: i === step ? 700 : 500,
                  color: i === step ? 'var(--y)' : i < step ? 'var(--txt2)' : 'var(--txt3)',
                  transition: 'color 0.3s',
                }}>{s.label}</span>
              </div>
            ))}
          </div>
          {/* Progress line */}
          <div style={{ height: 3, background: 'var(--card2)', borderRadius: 99, overflow: 'hidden', margin: '0 19px' }}>
            <div style={{
              height: '100%', borderRadius: 99, background: 'var(--y)',
              width: `${(step / (STEPS.length - 1)) * 100}%`,
              transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
              boxShadow: '0 0 8px rgba(255,209,0,0.5)',
            }} />
          </div>
        </div>

        {/* ── Sticky price bar ─────────────────────────────────── */}
        {price && (
          <div
            className={priceFlash ? 'price-flash' : ''}
            style={{
              position: 'sticky', top: 60, zIndex: 40,
              background: 'var(--y)', borderRadius: 14, marginBottom: 16,
              padding: '12px 18px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(255,209,0,0.25)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.55)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>מחיר משוער</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#000', lineHeight: 1 }}>₪{price.total}</div>
            </div>
            <div style={{ textAlign: 'left', fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
              {form.pickup_city && (
              <div style={{ fontWeight: 600 }}>
                {form.pickup_city} ←{' '}
                {form.trip_type === 'intercity' ? (form.destination_city || '?') : 'בן גוריון'}
              </div>
            )}
              <div style={{ fontWeight: 700, marginTop: 2 }}>🚗 {price.vehicle}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{price.range}</div>
            </div>
          </div>
        )}

        {/* ── Step content ─────────────────────────────────────── */}
        <div
          key={animKey}
          className={dir > 0 ? 'wiz-forward' : 'wiz-back'}
        >

          {/* STEP 0 – Personal ──────────────────────────────── */}
          {step === 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <StepTitle icon="👤" title="פרטים אישיים" />
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="field-enter">
                  <label>שם מלא *</label>
                  <input type="text" placeholder="ישראל ישראלי" value={form.customer_name}
                    onChange={e => setField('customer_name', e.target.value)} />
                </div>
                <div className="field-enter">
                  <label>טלפון *</label>
                  <PhoneInput
                    value={form.customer_phone}
                    onChange={(val, valid) => { setField('customer_phone', val); setPhoneValid(valid) }}
                  />
                </div>
                <div className="field-enter">
                  <label>אימייל (אופציונלי)</label>
                  <input type="email" placeholder="your@email.com" value={form.customer_email}
                    onChange={e => setField('customer_email', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 – Trip ──────────────────────────────────── */}
          {step === 1 && (
            <div className="card" style={{ marginBottom: 16, position: 'relative', zIndex: 10 }}>
              <StepTitle icon={form.trip_type === 'intercity' ? '🚗' : '✈️'} title="פרטי נסיעה" />
              <div style={{ display: 'grid', gap: 14 }}>

                {/* Trip type selector */}
                <div className="field-enter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(['airport', 'intercity'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => { setField('trip_type', t); if (t === 'airport') { setField('destination_city', ''); setField('destination_street', ''); setField('destination_house_number', ''); setDestinationAddressDisplay('') } }}
                      style={{
                        background: form.trip_type === t ? 'var(--y-dim)' : 'var(--card2)',
                        border: `2px solid ${form.trip_type === t ? 'var(--y)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{t === 'airport' ? '✈️' : '🚗'}</div>
                      <div style={{ fontWeight: 700, color: form.trip_type === t ? 'var(--y)' : 'var(--txt)', fontSize: 14 }}>
                        {t === 'airport' ? 'לשדה תעופה' : 'בין עירונית'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                        {t === 'airport' ? 'בן גוריון' : 'עיר לעיר'}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="field-enter">
                  <label>כתובת איסוף *</label>
                  <AddressAutocomplete value={addressDisplay} onSelect={handleAddressSelect} onClear={handleAddressClear} />
                </div>

                {form.pickup_city && (
                  <div className="field-enter" style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                      <Chip>📍 {form.pickup_city}</Chip>
                      {form.pickup_street && <Chip>🛣 {form.pickup_street} {form.pickup_house_number}</Chip>}
                      {form.trip_type === 'airport'
                      ? (CITY_PRICES[form.pickup_city]
                          ? <Chip yellow>מחיר בסיס: ₪{CITY_PRICES[form.pickup_city]}</Chip>
                          : <ChipOrange>עיר לא ברשימה — מחיר יתואם בטלפון</ChipOrange>)
                      : (INTERCITY_PRICES[form.pickup_city]
                          ? <Chip yellow>עיר נמצאה במחירון</Chip>
                          : <ChipOrange>עיר לא ברשימה — מחיר יתואם בטלפון</ChipOrange>)}
                    </div>
                    {form.pickup_street && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 12 }}>מספר בית:</label>
                        <input type="text" placeholder="7" value={form.pickup_house_number}
                          onChange={e => setField('pickup_house_number', e.target.value)}
                          style={{ width: 80, padding: '6px 10px', fontSize: 14 }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Intercity destination */}
                {form.trip_type === 'intercity' && (
                  <div className="field-enter" style={{ display: 'grid', gap: 10 }}>
                    <div>
                      <label>כתובת יעד *</label>
                      <AddressAutocomplete
                        value={destinationAddressDisplay}
                        onSelect={handleDestinationAddressSelect}
                        onClear={handleDestinationAddressClear}
                      />
                    </div>
                    {form.destination_city && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                        <Chip>📍 {form.destination_city}</Chip>
                        {form.destination_street && <Chip>🛣 {form.destination_street} {form.destination_house_number}</Chip>}
                        {form.pickup_city && (getIntercityPrice(form.pickup_city, form.destination_city)
                          ? <Chip yellow>מחיר בסיס: ₪{getIntercityPrice(form.pickup_city, form.destination_city)}</Chip>
                          : <ChipOrange>מסלול לא ברשימה — מחיר יתואם</ChipOrange>)}
                      </div>
                    )}
                    {form.destination_city && form.destination_street && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 12 }}>מספר בית:</label>
                        <input type="text" placeholder="7" value={form.destination_house_number}
                          onChange={e => setField('destination_house_number', e.target.value)}
                          style={{ width: 80, padding: '6px 10px', fontSize: 14 }} />
                      </div>
                    )}
                  </div>
                )}

                <div className="field-enter date-time-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ minWidth: 0 }}>
                    <label>תאריך נסיעה *</label>
                    <input type="date" min={new Date().toISOString().split('T')[0]}
                      value={form.travel_date} onChange={e => setField('travel_date', e.target.value)}
                      style={{ fontSize: 16, height: 48, padding: '0 12px', width: '100%', display: 'block' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label>שעת נסיעה *</label>
                    <input type="time" value={form.travel_time} onChange={e => setField('travel_time', e.target.value)}
                      style={{ fontSize: 16, height: 48, padding: '0 12px', width: '100%', display: 'block' }} />
                  </div>
                </div>

                {/* Return trip toggle */}
                <div className="field-enter">
                  <div
                    onClick={() => setField('return_trip', !form.return_trip)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: form.return_trip ? 'var(--y-dim)' : 'var(--card2)',
                      border: `1px solid ${form.return_trip ? 'rgba(255,209,0,0.3)' : 'var(--border)'}`,
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                    <span style={{ fontWeight: 600, color: 'var(--txt)', fontSize: 15 }}>
                      {form.trip_type === 'intercity' ? '🔄 אני צריך גם חזרה' : '✈️ אני צריך גם חזרה מהשדה'}
                    </span>
                    <div className={`toggle-track ${form.return_trip ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                </div>

                {form.return_trip && (
                  <div style={{ display: 'grid', gap: 14, padding: '4px 0' }}>
                    <div className="field-enter">
                      <label>{form.trip_type === 'intercity' ? 'כתובת יעד לחזרה *' : 'כתובת יעד לחזרה *'}</label>
                      <AddressAutocomplete value={returnAddressDisplay} onSelect={handleReturnAddressSelect} onClear={handleReturnAddressClear} />
                    </div>
                    {form.return_city && (
                      <div className="field-enter" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                        <Chip>📍 {form.return_city}</Chip>
                        {form.return_street && <Chip>🛣 {form.return_street} {form.return_house_number}</Chip>}
                      </div>
                    )}
                    <div className="field-enter" style={{ display: 'grid', gap: 12 }}>
                      {form.trip_type === 'airport' && <div>
                        <label>מספר טיסה</label>
                        <input type="text" placeholder="LY123" value={form.return_flight_number}
                          onChange={e => setField('return_flight_number', e.target.value)}
                          dir="ltr" style={{ textAlign: 'right', fontSize: 16, height: 48 }} />
                      </div>}
                      <div className="date-time-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                        <div style={{ minWidth: 0 }}>
                          <label>תאריך חזרה</label>
                          <input type="date" value={form.return_date}
                            onChange={e => setField('return_date', e.target.value)}
                            style={{ fontSize: 16, height: 48, padding: '0 12px', width: '100%', display: 'block' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label>שעה משוערת</label>
                          <input type="time" value={form.return_time}
                            onChange={e => setField('return_time', e.target.value)}
                            style={{ fontSize: 16, height: 48, padding: '0 12px', width: '100%', display: 'block' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 – Passengers & Extras ───────────────────── */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card field-enter">
                <StepTitle icon="🧳" title="נוסעים ומטען" />
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3,1fr)' }}>
                  <Stepper label="נוסעים" value={form.passengers} min={1} onChange={d => stepChange('passengers', d)} />
                  <Stepper label="מזוודות" value={form.large_luggage} min={0} onChange={d => stepChange('large_luggage', d)} />
                  <Stepper label="טרולי" value={form.trolley} min={0} onChange={d => stepChange('trolley', d)} />
                </div>
              </div>
              <div className="card field-enter" style={{ animationDelay: '0.08s' }}>
                <StepTitle icon="⭐" title="תוספות שירות" />
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                  <ExtraCheck label="נקודה נוספת באותו ישוב" sub="+₪20" checked={!!form.extras.additional_stop} onChange={v => setExtra('additional_stop', v)} />
                  <ExtraCheck label="נקודה נוספת בישוב סמוך" sub="+₪40" checked={!!form.extras.nearby_city_stop} onChange={v => setExtra('nearby_city_stop', v)} />
                  <ExtraCheck label="ילד עד גיל 4" sub="+₪10" checked={!!form.extras.child_under4} onChange={v => setExtra('child_under4', v)} />
                  <ExtraCheck label="כיסא בטיחות" sub="+₪40–70" checked={!!form.extras.safety_seat} onChange={v => setExtra('safety_seat', v)} />
                  <ExtraCheck label="ציוד סקי / גלישה" sub="+₪20" checked={!!form.extras.ski_equipment} onChange={v => setExtra('ski_equipment', v)} />
                  <ExtraCheck label="ארגז אופניים" sub="+₪50" checked={!!form.extras.bike_rack} onChange={v => setExtra('bike_rack', v)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 – Payment ───────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card field-enter">
                <StepTitle icon="💳" title="אמצעי תשלום" />
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                  <PayMethod label="מזומן" icon="💵" selected={form.payment_method === 'cash'} onClick={() => setField('payment_method', 'cash')} />
                  <PayMethod label="ביט" icon="📱" sub="+₪10" selected={form.payment_method === 'bit'} onClick={() => setField('payment_method', 'bit')} />
                </div>
              </div>
              <div className="card field-enter" style={{ animationDelay: '0.06s' }}>
                <label style={{ fontSize: 13, color: 'var(--txt2)' }}>הערות מיוחדות</label>
                <textarea rows={3} placeholder="בקשות מיוחדות, הנחיות גישה..."
                  value={form.special_requests} onChange={e => setField('special_requests', e.target.value)}
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}

        </div>{/* end step content */}

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
            borderRadius: 8, padding: '10px 14px', color: '#E74C3C', fontSize: 14, margin: '16px 0',
          }}>{error}</div>
        )}

        {/* ── Navigation ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {step > 0 && (
            <button type="button" onClick={() => goTo(step - 1)}
              style={{
                background: 'var(--card2)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 20px', color: 'var(--txt2)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}>
              → חזור
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              style={{
                flex: 1, background: 'var(--y)', border: 'none', borderRadius: 14,
                padding: '14px 20px', color: '#000', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              הבא
              <span style={{
                background: 'rgba(0,0,0,0.15)', borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>←</span>
            </button>
          ) : (
            <button type="submit" disabled={submitting}
              style={{
                flex: 1, background: 'var(--y)', border: 'none', borderRadius: 14,
                padding: '14px 20px', color: '#000', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {submitting ? 'שולח...' : (
                <>
                  {price ? `הזמן עכשיו – ₪${price.total}` : 'הזמן עכשיו'}
                  <span style={{
                    background: 'rgba(0,0,0,0.15)', borderRadius: '50%', width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>🚀</span>
                </>
              )}
            </button>
          )}
        </div>

      </form>
    </>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function StepTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>{title}</h3>
    </div>
  )
}

function Chip({ children, yellow }: { children: React.ReactNode; yellow?: boolean }) {
  return (
    <span style={{
      background: yellow ? 'rgba(255,209,0,0.1)' : 'var(--card2)',
      border: `1px solid ${yellow ? 'rgba(255,209,0,0.3)' : 'var(--border)'}`,
      color: yellow ? 'var(--y)' : 'var(--txt2)',
      borderRadius: 6, padding: '3px 10px', fontSize: 12,
    }}>{children}</span>
  )
}
function ChipOrange({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'rgba(255,150,0,0.1)', border: '1px solid rgba(255,150,0,0.3)',
      color: '#FFA500', borderRadius: 6, padding: '3px 10px', fontSize: 11,
    }}>{children}</span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label>{label}</label>{children}</div>
}

function Stepper({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (d: number) => void }) {
  return (
    <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 8px' }}>
      <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 8, fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <button type="button" onClick={() => onChange(-1)} disabled={value <= min}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', color: 'var(--txt)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--txt)', minWidth: 20, textAlign: 'center' }}>{value}</span>
        <button type="button" onClick={() => onChange(1)}
          style={{ background: 'var(--y)', border: 'none', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', color: '#000', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
      </div>
    </div>
  )
}

function ExtraCheck({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      background: checked ? 'var(--y-dim)' : 'var(--card2)',
      border: `1px solid ${checked ? 'rgba(255,209,0,0.3)' : 'var(--border)'}`,
      borderRadius: 8, padding: '10px 12px', transition: 'all 0.15s', userSelect: 'none',
    }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 'auto', accentColor: 'var(--y)', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--y)' }}>{sub}</div>
      </div>
    </label>
  )
}

function PayMethod({ label, icon, sub, selected, onClick }: { label: string; icon: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        background: selected ? 'var(--y-dim)' : 'var(--card2)',
        border: `2px solid ${selected ? 'var(--y)' : 'var(--border)'}`,
        borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'center',
        transition: 'all 0.15s', width: '100%',
      }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: selected ? 'var(--y)' : 'var(--txt)', fontSize: 16 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>{sub}</div>}
    </button>
  )
}
