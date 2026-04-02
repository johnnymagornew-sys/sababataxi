'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import AddressAutocomplete, { ParsedAddress } from './AddressAutocomplete'
import PickupMapSelector from './PickupMapSelector'
import IntercityMapSelector from './IntercityMapSelector'
import PhoneInput from './PhoneInput'
import { calculatePrice, getTimeSurcharges } from '@/lib/pricing'
import { getTierIndex, getTierBasePrice, TIER_LABELS, TIER_PRICES } from '@/lib/tierPrices'
import { INTERCITY_PRICES, getIntercityPrice, getIntercityTierIndex, INTERCITY_VEHICLE_TIERS } from '@/lib/intercityPrices'
import type { BookingExtras } from '@/types/database'
import { useTranslations, useLocale } from 'next-intl'

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
  airport_direction: 'to_airport' | 'from_airport'
  flight_number: string
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
  airport_direction: 'to_airport',
  flight_number: '',
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

// ─── Component ────────────────────────────────────────────────────
export default function BookingForm() {
  const t = useTranslations('booking')
  const tCommon = useTranslations('common')
  const tV = useTranslations('vehicles')
  const locale = useLocale()
  const STEPS = [
    { label: t('steps.details'), icon: '👤' },
    { label: t('steps.trip'), icon: '✈️' },
    { label: t('steps.passengers'), icon: '🧳' },
    { label: t('steps.payment'), icon: '💳' },
  ]
  const [form, setForm] = useState<FormData>(initialForm)
  const [addressDisplay, setAddressDisplay] = useState('')
  const [selectedPickup, setSelectedPickup] = useState<ParsedAddress | null>(null)
  const [destinationAddressDisplay, setDestinationAddressDisplay] = useState('')
  const [selectedDestination, setSelectedDestination] = useState<ParsedAddress | null>(null)
  const [returnAddressDisplay, setReturnAddressDisplay] = useState('')
  const [price, setPrice] = useState<{ total: number; tierBase: number; vehicle: string; range: string; inTable: boolean } | null>(null)
  const [returnPrice, setReturnPrice] = useState<{ total: number; diffCity: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [animKey, setAnimKey] = useState(0)
  const prevPrice = useRef<number | null>(null)
  const [priceFlash, setPriceFlash] = useState(false)
  const [phoneValid, setPhoneValid] = useState(false)
  const formTopRef = useRef<HTMLDivElement>(null)
// Price calculation
  useEffect(() => {
    const idx = getTierIndex(form.passengers)
    const vehicleKeys = ['taxi', 'van', 'vanLarge', 'minibus', 'minibusLarge', 'minibusXL'] as const
    const rangeKeys = ['range04', 'range56', 'range78', 'range910', 'range1114', 'range15plus'] as const
    const vehicle = tV(vehicleKeys[idx])
    const range = tV(rangeKeys[idx])

    if (form.trip_type === 'intercity') {
      if (!form.pickup_city || !form.destination_city) { setPrice(null); return }
      // Determine if night for correct base price
      let isNight = false
      if (form.travel_date && form.travel_time) {
        const dateTime = new Date(`${form.travel_date}T${form.travel_time}`)
        const s = getTimeSurcharges(dateTime)
        isNight = s.night || s.shabbat
      }
      const basePrice = getIntercityPrice(form.pickup_city, form.destination_city, form.passengers, isNight)
      if (!basePrice) { setPrice(null); return }
      const tierIdx = getIntercityTierIndex(form.passengers)
      const intercityVehicleKeys = ['intercityTaxi', 'intercityMinibus', 'intercityMinibusLarge', 'intercityVanMinibus', 'intercitySmallBus', 'intercityBus'] as const
      const tier = INTERCITY_VEHICLE_TIERS[tierIdx]
      const intercityVehicle = tV(intercityVehicleKeys[tierIdx])
      const intercityRange = tier.passengers
      let total = basePrice
      if (form.travel_date && form.travel_time) {
        const dateTime = new Date(`${form.travel_date}T${form.travel_time}`)
        const s = getTimeSurcharges(dateTime)
        if (s.peak) total += 20
      }
      if (form.extras.additional_stop) total += 20
      if (form.extras.nearby_city_stop) total += 40
      if (form.extras.child_under4) total += 10
      if (form.extras.safety_seat) total += 55
      if (form.extras.ski_equipment) total += 20
      if (form.extras.bike_rack) total += 50
      if (form.payment_method === 'bit') total += 10
      setPrice({ total, tierBase: basePrice, vehicle: intercityVehicle, range: intercityRange, inTable: true })
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
    const { total: calcTotal } = calculatePrice({
      city: form.pickup_city, basePrice: fallbackBase, passengers: form.passengers,
      travelDate: form.travel_date, travelTime: form.travel_time,
      extras: form.extras, paymentMethod: form.payment_method,
    })
    const total = calcTotal + (form.airport_direction === 'from_airport' ? 10 : 0)
    setPrice({ total, tierBase, vehicle, range, inTable })
  }, [form.trip_type, form.pickup_city, form.destination_city, form.passengers, form.travel_date, form.travel_time, form.extras, form.payment_method, tV])

  // Return trip price calculation
  useEffect(() => {
    if (!form.return_trip || !price) { setReturnPrice(null); return }

    const RETURN_FEE = 10
    const returnCity = form.return_city || form.pickup_city

    if (form.trip_type === 'airport') {
      const diffCity = !!form.return_city && form.return_city !== form.pickup_city
      if (!diffCity) {
        // Same city — return = outbound base + surcharges for return date/time + 10₪
        setReturnPrice({ total: price.total + RETURN_FEE, diffCity: false })
        return
      }
      // Different return city — calculate its own price
      const returnBase = CITY_PRICES[returnCity]
      if (!returnBase) { setReturnPrice({ total: price.total + RETURN_FEE, diffCity: true }); return }
      let returnTotal = getTierBasePrice(returnCity, form.passengers, returnBase)
      if (form.return_date && form.return_time) {
        const { total: withSurcharges } = calculatePrice({
          city: returnCity, basePrice: returnBase, passengers: form.passengers,
          travelDate: form.return_date, travelTime: form.return_time,
          extras: {}, paymentMethod: form.payment_method,
        })
        returnTotal = withSurcharges
      }
      setReturnPrice({ total: returnTotal + RETURN_FEE, diffCity: true })
    } else {
      // Intercity: return trip goes from destination → pickup (or return_city → pickup)
      const fromCity = form.return_city || form.destination_city
      const toCity = form.pickup_city
      if (!fromCity || !toCity) { setReturnPrice(null); return }
      const diffCity = !!form.return_city && form.return_city !== form.destination_city
      let returnTotal: number
      const intercityBase = getIntercityPrice(fromCity, toCity, form.passengers)
      if (intercityBase) {
        returnTotal = intercityBase
        if (form.return_date && form.return_time) {
          const dateTime = new Date(`${form.return_date}T${form.return_time}`)
          const s = getTimeSurcharges(dateTime)
          if (s.peak) returnTotal += 20
        }
      } else {
        returnTotal = price.total
      }
      setReturnPrice({ total: returnTotal + RETURN_FEE, diffCity })
    }
  }, [form.return_trip, form.return_city, form.return_date, form.return_time,
      form.pickup_city, form.destination_city, form.trip_type, form.passengers,
      form.payment_method, price])

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
    const normalized = { ...parsed, city }
    setAddressDisplay(parsed.displayName)
    setSelectedPickup(normalized)
    setField('pickup_city', city)
    setField('pickup_street', parsed.street)
    setField('pickup_house_number', parsed.houseNumber)
  }
  function handleAddressClear() {
    setAddressDisplay('')
    setSelectedPickup(null)
    setField('pickup_city', ''); setField('pickup_street', ''); setField('pickup_house_number', '')
  }
  function handleDestinationAddressSelect(parsed: ParsedAddress) {
    const city = normalizeCity(parsed.city)
    const normalized = { ...parsed, city }
    setDestinationAddressDisplay(parsed.displayName)
    setSelectedDestination(normalized)
    setField('destination_city', city)
    setField('destination_street', parsed.street)
    setField('destination_house_number', parsed.houseNumber)
  }
  function handleDestinationAddressClear() {
    setDestinationAddressDisplay('')
    setSelectedDestination(null)
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
    setTimeout(() => {
      setStep(next)
      setAnimKey(k => k + 1)
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 10)
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.customer_name.trim()) return t('validation.nameRequired')
      if (!form.customer_phone.trim()) return t('validation.phoneRequired')
      if (!phoneValid) return t('validation.phoneInvalid')
    }
    if (step === 1) {
      if (!form.pickup_city) return t('validation.pickupRequired')
      if (form.trip_type === 'intercity' && !form.destination_city) return t('validation.destinationRequired')
      if (!form.travel_date) return t('validation.dateRequired')
      if (!form.travel_time) return t('validation.timeRequired')
      if (form.trip_type === 'airport' && form.airport_direction === 'from_airport' && !form.flight_number.trim()) return t('validation.flightRequired')
      if (form.return_trip && form.trip_type === 'airport' && !form.return_flight_number.trim()) return t('validation.returnFlightRequired')
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
        body: JSON.stringify({
          ...form,
          price: (price?.total ?? 0) + (returnPrice?.total ?? 0),
          price_outbound: price?.total ?? 0,
          price_return: returnPrice?.total ?? 0,
          locale,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('validation.sendError'))
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('validation.sendError'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginTop: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', color: 'var(--txt)' }}>{t('success.title')}</h2>
        <p style={{ color: 'var(--txt2)', fontSize: 16, margin: '0 0 8px' }}>{t('success.message')}</p>
        {form.customer_email && (
          <p style={{ color: 'var(--txt2)', fontSize: 14 }}>{t('success.emailConfirm', { email: form.customer_email })}</p>
        )}
        <button className="btn-yellow" style={{ margin: '24px auto 0', maxWidth: 200 }}
          onClick={() => { setForm(initialForm); setAddressDisplay(''); setReturnAddressDisplay(''); setStep(0); setSubmitted(false) }}>
          {t('success.newBooking')}
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
        /* Native date/time inputs styled for dark theme */
        input[type="date"].dt-pick, input[type="time"].dt-pick {
          background: var(--card2);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--txt3);
          cursor: pointer;
          height: 44px;
          width: 100%;
          padding: 0 12px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          color-scheme: dark;
          transition: border-color 0.15s, background 0.15s;
        }
        input[type="date"].dt-pick::-webkit-calendar-picker-indicator,
        input[type="time"].dt-pick::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }
        input[type="date"].dt-pick.has-value,
        input[type="time"].dt-pick.has-value {
          background: rgba(255,209,0,0.06);
          border-color: rgba(255,209,0,0.3);
          color: var(--txt);
        }
      `}</style>

      <div ref={formTopRef} style={{ scrollMarginTop: 72 }} />
      <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>

        {/* ── Sticky header: progress bar + price ─────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--bg)',
          paddingTop: 12,
          marginBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Progress dots */}
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
          {/* Price bar — shown on steps 0-2 when price exists */}
          {price && step < 3 && (
            <div style={{ margin: '10px 0 10px', display: 'grid', gap: 6, gridTemplateColumns: returnPrice?.diffCity ? '1fr 1fr' : '1fr' }}>
              {/* Outbound */}
              <div className={priceFlash ? 'price-flash' : ''}
                style={{
                  background: 'var(--y)', borderRadius: 14,
                  padding: '10px 14px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 20px rgba(255,209,0,0.25)',
                }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{returnPrice?.diffCity ? t('step3.outboundLabel') : t('step3.estimatedPrice')}</div>
                  <div style={{ fontSize: returnPrice?.diffCity ? 22 : 26, fontWeight: 900, color: '#000', lineHeight: 1 }}>₪{price.total}</div>
                </div>
                <div style={{ textAlign: 'left', fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>
                  {form.pickup_city && (
                    <div style={{ fontWeight: 600, fontSize: 10 }}>
                      {form.trip_type === 'airport'
                        ? (form.airport_direction === 'to_airport'
                            ? `${form.pickup_city} ← נתב״ג`
                            : `נתב״ג ← ${form.pickup_city}`)
                        : `${form.pickup_city} ← ${form.destination_city || '?'}`}
                    </div>
                  )}
                  <div style={{ fontWeight: 700, marginTop: 2 }}>🚗 {price.vehicle}</div>
                  {returnPrice && !returnPrice.diffCity && (
                    <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)', marginTop: 3, lineHeight: 1.3, whiteSpace: 'pre-line' }}>
                      {t('step3.returnBarNote')}
                    </div>
                  )}
                </div>
              </div>
              {/* Return — only when different city */}
              {returnPrice?.diffCity && (
                <div style={{
                  background: 'rgba(255,209,0,0.15)', borderRadius: 14,
                  padding: '10px 14px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid rgba(255,209,0,0.4)',
                }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--y)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('step3.returnLabel')}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--y)', lineHeight: 1 }}>₪{returnPrice.total}</div>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', marginTop: 2 }}>{t('step3.returnIncludesFee')}</div>
                  </div>
                  <div style={{ textAlign: 'left', fontSize: 10, color: 'var(--txt3)' }}>
                    <div style={{ fontWeight: 600 }}>{form.return_city} ← נתב״ג</div>
                    <div style={{ fontWeight: 800, color: 'var(--y)', fontSize: 13, marginTop: 4 }}>{t('step3.totalLabel')} ₪{price.total + returnPrice.total}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step content ─────────────────────────────────────── */}
        <div
          key={animKey}
          className={dir > 0 ? 'wiz-forward' : 'wiz-back'}
        >

          {/* STEP 0 – Personal ──────────────────────────────── */}
          {step === 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <StepTitle icon="👤" title={t('step0.title')} />
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="field-enter">
                  <label>{t('step0.nameLabel')}</label>
                  <input type="text" placeholder={t('step0.namePlaceholder')} value={form.customer_name}
                    onChange={e => setField('customer_name', e.target.value)} />
                </div>
                <div className="field-enter">
                  <label>{t('step0.phoneLabel')}</label>
                  <PhoneInput
                    value={form.customer_phone}
                    onChange={(val, valid) => { setField('customer_phone', val); setPhoneValid(valid) }}
                  />
                </div>
                <div className="field-enter">
                  <label>{t('step0.emailLabel')}</label>
                  <input type="email" placeholder="your@email.com" value={form.customer_email}
                    onChange={e => setField('customer_email', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 – Trip ──────────────────────────────────── */}
          {step === 1 && (
            <div className="card" style={{ marginBottom: 16, position: 'relative', zIndex: 10 }}>
              <StepTitle icon={form.trip_type === 'intercity' ? '🚗' : '✈️'} title={t('step1.title')} />
              <div style={{ display: 'grid', gap: 14 }}>

                {/* Trip type selector */}
                <div className="field-enter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(['airport', 'intercity'] as const).map(tripType => (
                    <button key={tripType} type="button"
                      onClick={() => { setField('trip_type', tripType); if (tripType === 'airport') { setField('destination_city', ''); setField('destination_street', ''); setField('destination_house_number', ''); setDestinationAddressDisplay('') } }}
                      style={{
                        background: form.trip_type === tripType ? 'var(--y-dim)' : 'var(--card2)',
                        border: `2px solid ${form.trip_type === tripType ? 'var(--y)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{tripType === 'airport' ? '✈️' : '🚗'}</div>
                      <div style={{ fontWeight: 700, color: form.trip_type === tripType ? 'var(--y)' : 'var(--txt)', fontSize: 14 }}>
                        {tripType === 'airport' ? t('step1.tripTypeAirport') : t('step1.tripTypeIntercity')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                        {tripType === 'airport' ? t('step1.tripTypeAirportSub') : t('step1.tripTypeIntercitySub')}
                      </div>
                    </button>
                  ))}
                </div>

                {form.trip_type === 'airport' ? (
                  <div className="field-enter" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* From box */}
                    <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                        {form.airport_direction === 'to_airport' ? t('step1.fromLabel') : t('step1.fromLabelAlt')}
                      </div>
                      {form.airport_direction === 'to_airport' ? (
                        <PickupMapSelector
                          value={addressDisplay}
                          selected={selectedPickup}
                          onSelect={handleAddressSelect}
                          onClear={handleAddressClear}
                          houseNumber={form.pickup_house_number}
                          onHouseNumberChange={v => setField('pickup_house_number', v)}
                          priceChip={form.pickup_city
                            ? (CITY_PRICES[form.pickup_city]
                                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD100', background: 'rgba(255,209,0,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(255,209,0,0.2)' }}>{t('step1.priceBase', { price: CITY_PRICES[form.pickup_city] })}</span>
                                : <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: 'rgba(249,115,22,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(249,115,22,0.2)' }}>{t('step1.priceByPhone')}</span>)
                            : undefined}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                          <span style={{ fontSize: 22 }}>✈️</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>{t('step1.airportName')}</div>
                            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{t('step1.terminal')}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Swap button */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newDir = form.airport_direction === 'to_airport' ? 'from_airport' : 'to_airport'
                          setField('airport_direction', newDir)
                          setField('flight_number', '')
                          if (newDir === 'from_airport') {
                            setReturnAddressDisplay('')
                            setForm(prev => ({ ...prev, return_trip: false, return_city: '', return_street: '', return_house_number: '' }))
                          }
                        }}
                        style={{
                          background: 'var(--card2)', border: '1px solid var(--border)',
                          borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
                          fontSize: 13, fontWeight: 700, color: 'var(--y)',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {t('step1.swapDirection')}
                      </button>
                    </div>

                    {/* To box */}
                    <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                        {form.airport_direction === 'to_airport' ? t('step1.toLabel') : t('step1.toLabelAlt')}
                      </div>
                      {form.airport_direction === 'to_airport' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                          <span style={{ fontSize: 22 }}>✈️</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>{t('step1.airportName')}</div>
                            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{t('step1.terminal')}</div>
                          </div>
                        </div>
                      ) : (
                        <PickupMapSelector
                          value={addressDisplay}
                          selected={selectedPickup}
                          onSelect={handleAddressSelect}
                          onClear={handleAddressClear}
                          houseNumber={form.pickup_house_number}
                          onHouseNumberChange={v => setField('pickup_house_number', v)}
                          priceChip={form.pickup_city
                            ? (CITY_PRICES[form.pickup_city]
                                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD100', background: 'rgba(255,209,0,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(255,209,0,0.2)' }}>{t('step1.priceBase', { price: CITY_PRICES[form.pickup_city] })}</span>
                                : <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: 'rgba(249,115,22,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(249,115,22,0.2)' }}>{t('step1.priceByPhone')}</span>)
                            : undefined}
                        />
                      )}
                    </div>

                    {/* Flight number — required when from_airport */}
                    {form.airport_direction === 'from_airport' && (
                      <>
                        <div>
                          <label>{t('step1.flightNumber')}</label>
                          <input
                            type="text"
                            placeholder="LY123"
                            value={form.flight_number}
                            onChange={e => setField('flight_number', e.target.value)}
                            dir="ltr"
                            style={{ textAlign: 'right', fontSize: 16, height: 48 }}
                          />
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          background: 'rgba(52,211,153,0.07)',
                          border: '1px solid rgba(52,211,153,0.25)',
                          borderRadius: 12, padding: '12px 14px',
                        }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>✈️</span>
                          <span style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.55 }}>
                            {t('step1.flightTrackingNote')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="field-enter">
                    <IntercityMapSelector
                      pickup={selectedPickup}
                      destination={selectedDestination}
                      pickupHouseNumber={form.pickup_house_number}
                      destinationHouseNumber={form.destination_house_number}
                      onPickupSelect={handleAddressSelect}
                      onDestinationSelect={handleDestinationAddressSelect}
                      onPickupClear={handleAddressClear}
                      onDestinationClear={handleDestinationAddressClear}
                      onPickupHouseNumberChange={v => setField('pickup_house_number', v)}
                      onDestinationHouseNumberChange={v => setField('destination_house_number', v)}
                      priceChip={form.pickup_city && form.destination_city
                        ? (getIntercityPrice(form.pickup_city, form.destination_city)
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD100', background: 'rgba(255,209,0,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(255,209,0,0.2)' }}>{t('step1.priceBase', { price: getIntercityPrice(form.pickup_city, form.destination_city) ?? 0 })}</span>
                            : <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: 'rgba(249,115,22,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(249,115,22,0.2)' }}>{t('step1.routeNotListed')}</span>)
                        : undefined}
                    />
                  </div>
                )}

                <div className="field-enter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Date */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--y)', marginBottom: 6, textAlign: 'center' }}>{t('step1.dateLabel')}</div>
                    <input type="date" className={`dt-pick${form.travel_date ? ' has-value' : ''}`}
                      min={new Date().toISOString().split('T')[0]}
                      value={form.travel_date} onChange={e => setField('travel_date', e.target.value)} />
                  </div>
                  {/* Time */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--y)', marginBottom: 6, textAlign: 'center' }}>{t('step1.timeLabel')}</div>
                    <input type="time" className={`dt-pick${form.travel_time ? ' has-value' : ''}`}
                      value={form.travel_time} onChange={e => setField('travel_time', e.target.value)} />
                  </div>
                </div>

                {/* Return trip toggle — only for airport to_airport bookings */}
                {form.trip_type === 'airport' && form.airport_direction !== 'from_airport' ? (
                <div className="field-enter">
                  <div
                    onClick={() => {
                      const newVal = !form.return_trip
                      if (newVal) {
                        // Pre-fill return address with pickup address
                        setReturnAddressDisplay(addressDisplay)
                        setForm(prev => ({ ...prev, return_trip: true, return_city: form.pickup_city, return_street: form.pickup_street, return_house_number: form.pickup_house_number }))
                      } else {
                        setReturnAddressDisplay('')
                        setForm(prev => ({ ...prev, return_trip: false, return_city: '', return_street: '', return_house_number: '' }))
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: form.return_trip ? 'var(--y-dim)' : 'var(--card2)',
                      border: `1px solid ${form.return_trip ? 'rgba(255,209,0,0.3)' : 'var(--border)'}`,
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                    <span style={{ fontWeight: 600, color: 'var(--txt)', fontSize: 15 }}>
                      {form.trip_type === 'intercity' ? t('step1.returnTripIntercity') : t('step1.returnTripAirport')}
                    </span>
                    <div className={`toggle-track ${form.return_trip ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                </div>
                ) : null}

                {form.return_trip && (
                  <div style={{ display: 'grid', gap: 14, padding: '4px 0' }}>
                    <div className="field-enter">
                      <label>{t('step1.returnAddress')}</label>
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
                        <label>{t('step1.flightNumber')}</label>
                        <input type="text" placeholder="LY123" value={form.return_flight_number}
                          onChange={e => setField('return_flight_number', e.target.value)}
                          dir="ltr" style={{ textAlign: 'right', fontSize: 16, height: 48 }} />
                      </div>}
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--y)', marginBottom: 6, textAlign: 'center' }}>{t('step1.returnDate')}</div>
                          <input type="date" className={`dt-pick${form.return_date ? ' has-value' : ''}`}
                            value={form.return_date} onChange={e => setField('return_date', e.target.value)} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--y)', marginBottom: 6, textAlign: 'center' }}>{t('step1.returnTime')}</div>
                          <input type="time" className={`dt-pick${form.return_time ? ' has-value' : ''}`}
                            value={form.return_time} onChange={e => setField('return_time', e.target.value)} />
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
                <StepTitle icon="🧳" title={t('step2.passengersTitle')} />
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3,1fr)' }}>
                  <Stepper label={t('step2.passengersLabel')} value={form.passengers} min={1} onChange={d => stepChange('passengers', d)} icon="👥" />
                  <Stepper label={t('step2.luggageLabel')} value={form.large_luggage} min={0} onChange={d => stepChange('large_luggage', d)} icon="🧳" sub={t('step2.luggageSub')} />
                  <Stepper label={t('step2.trolleyLabel')} value={form.trolley} min={0} onChange={d => stepChange('trolley', d)} icon="🛄" sub={t('step2.trolleySub')} />
                </div>
              </div>
              <div className="card field-enter" style={{ animationDelay: '0.08s' }}>
                <StepTitle icon="⭐" title={t('step2.extrasTitle')} />
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3,1fr)', overflow: 'hidden' }}>
                  <ExtraIcon
                    icon="📍" label={t('step2.extraStop')} price={t('step2.extraStopPrice')}
                    note={t('step2.extraStopNote')}
                    checked={!!form.extras.additional_stop} onChange={v => setExtra('additional_stop', v)} />
                  <ExtraIcon
                    icon="🗺️" label={t('step2.extraNearby')} price={t('step2.extraNearbyPrice')}
                    note={t('step2.extraNearbyNote')}
                    checked={!!form.extras.nearby_city_stop} onChange={v => setExtra('nearby_city_stop', v)} />
                  <ExtraIcon
                    icon="👶" label={t('step2.extraChild')} price={t('step2.extraChildPrice')}
                    note={t('step2.extraChildNote')}
                    checked={!!form.extras.child_under4} onChange={v => setExtra('child_under4', v)} />
                  <ExtraIcon
                    iconSrc="/baby_sit.png" label={t('step2.extraSafetySeat')} price={t('step2.extraSafetySeatPrice')}
                    note={t('step2.extraSafetySeatNote')}
                    checked={!!form.extras.safety_seat} onChange={v => setExtra('safety_seat', v)} />
                  <ExtraIcon
                    icon="⛷️" label={t('step2.extraSki')} price={t('step2.extraSkiPrice')}
                    note={t('step2.extraSkiNote')}
                    checked={!!form.extras.ski_equipment} onChange={v => setExtra('ski_equipment', v)} />
                  <ExtraIcon
                    icon="🚲" label={t('step2.extraBike')} price={t('step2.extraBikePrice')}
                    note={t('step2.extraBikeNote')}
                    checked={!!form.extras.bike_rack} onChange={v => setExtra('bike_rack', v)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 – Summary ──────────────────────────────── */}
          {step === 3 && (
            <div className="field-enter" style={{ display: 'grid', gap: 20 }}>

              {/* Editorial header */}
              <div style={{ textAlign: 'right', padding: '4px 2px 0' }}>
                <h2 style={{ fontSize: 'clamp(32px,8vw,44px)', fontWeight: 900, color: 'var(--txt)', margin: 0, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                  {t('step3.title')}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--txt3)', margin: '6px 0 0', fontWeight: 500 }}>
                  {t('step3.subtitle')}
                </p>
              </div>

              {/* Glass trip card */}
              <div style={{
                position: 'relative', overflow: 'hidden', borderRadius: 20,
                background: 'rgba(53,53,52,0.55)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                padding: '28px 22px 22px',
              }}>
                {/* Map decoration top-left */}
                <div style={{ position: 'absolute', top: -32, left: -32, width: 160, height: 160, opacity: 0.12, pointerEvents: 'none' }}>
                  <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
                    <circle cx="80" cy="80" r="70" stroke="#FFD700" strokeWidth="1"/>
                    <circle cx="80" cy="80" r="50" stroke="#FFD700" strokeWidth="0.8"/>
                    <circle cx="80" cy="80" r="30" stroke="#FFD700" strokeWidth="0.6"/>
                    <line x1="10" y1="80" x2="150" y2="80" stroke="#FFD700" strokeWidth="0.6"/>
                    <line x1="80" y1="10" x2="80" y2="150" stroke="#FFD700" strokeWidth="0.6"/>
                    <line x1="30" y1="30" x2="130" y2="130" stroke="#FFD700" strokeWidth="0.4"/>
                    <line x1="130" y1="30" x2="30" y2="130" stroke="#FFD700" strokeWidth="0.4"/>
                  </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 22 }}>
                  {/* Route */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* Pickup */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 8px rgba(255,215,0,0.6)', flexShrink: 0 }} />
                        <div style={{ width: 1.5, height: 40, background: 'linear-gradient(to bottom, #FFD700, rgba(255,255,255,0.1))', margin: '3px 0' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{t('step3.pickupLabel')}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', lineHeight: 1.25 }}>
                          {form.trip_type === 'airport' && form.airport_direction === 'from_airport'
                            ? `${t('step1.airportName')}, ${t('step1.terminal')}`
                            : (form.pickup_street ? `${form.pickup_street} ${form.pickup_house_number}, ${form.pickup_city}` : form.pickup_city || '—')}
                        </div>
                      </div>
                    </div>
                    {/* Destination */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
                        <div style={{ fontSize: 18, color: 'var(--txt)', lineHeight: 1, marginRight: 0 }}>📍</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{t('step3.destinationLabel')}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', lineHeight: 1.25 }}>
                          {form.trip_type === 'airport'
                            ? (form.airport_direction === 'to_airport'
                                ? `${t('step1.airportName')}, ${t('step1.terminal')}`
                                : (form.pickup_street ? `${form.pickup_street} ${form.pickup_house_number}, ${form.pickup_city}` : form.pickup_city || '—'))
                            : (form.destination_street
                                ? `${form.destination_street} ${form.destination_house_number}, ${form.destination_city}`
                                : form.destination_city || '—')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date + Time */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{t('step3.dateLabel')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>📅</span>
                        <span style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 14 }}>
                          {form.travel_date
                            ? new Date(form.travel_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{t('step3.timeLabel')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>🕐</span>
                        <span style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 14 }}>
                          {form.travel_time ? form.travel_time.slice(0, 5) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Passengers + luggage row */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '4px 12px' }}>
                      👥 {form.passengers !== 1 ? t('passengerCountPlural', { count: form.passengers }) : t('passengerCount', { count: form.passengers })}
                    </span>
                    {form.large_luggage > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '4px 12px' }}>
                        🧳 {form.large_luggage !== 1 ? t('luggageCountPlural', { count: form.large_luggage }) : t('luggageCount', { count: form.large_luggage })}
                      </span>
                    )}
                    {form.trolley > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '4px 12px' }}>
                        🎒 {form.trolley} {t('step2.trolleyLabel')}
                      </span>
                    )}
                    {price && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,209,0,0.8)', background: 'rgba(255,209,0,0.08)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,209,0,0.15)' }}>
                        🚗 {price.vehicle} · {price.range}
                      </span>
                    )}
                  </div>

                  {/* Extras */}
                  {Object.values(form.extras).some(Boolean) && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{t('step3.extrasLabel')}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {form.extras.additional_stop && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{t('extraChips.additionalStop')}</span>}
                        {form.extras.nearby_city_stop && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{t('extraChips.nearbyCity')}</span>}
                        {form.extras.child_under4 && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{t('extraChips.childUnder4')}</span>}
                        {form.extras.safety_seat && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{t('extraChips.safetySeat')}</span>}
                        {form.extras.ski_equipment && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{t('extraChips.skiEquipment')}</span>}
                        {form.extras.bike_rack && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>{t('extraChips.bikeRack')}</span>}
                      </div>
                    </div>
                  )}

                  {/* Return trip */}
                  {form.return_trip && (
                    <div style={{ background: 'rgba(255,209,0,0.06)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,209,0,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('step3.returnTripLabel')}</div>
                        {returnPrice && (
                          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--y)' }}>₪{returnPrice.total}
                            <span style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 500, marginRight: 4 }}>{t('step3.returnIncluded')}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>
                        {form.return_city
                          ? `${form.return_street ? form.return_street + ' ' + form.return_house_number + ', ' : ''}${form.return_city}`
                          : form.pickup_city}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--txt3)' }}>
                        {form.return_date && <span>📅 {new Date(form.return_date + 'T12:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</span>}
                        {form.return_time && <span>🕐 {form.return_time.slice(0, 5)}</span>}
                        {form.return_flight_number && <span>✈️ {form.return_flight_number}</span>}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                  {/* Personal details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>{t('step3.nameLabel')}</div>
                      <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 14 }}>{form.customer_name || '—'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>{t('step3.phoneLabel')}</div>
                      <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 14, direction: 'ltr', textAlign: 'right' }}>{form.customer_phone || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 4px' }}>
                <button type="button" onClick={() => goTo(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--y)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}>
                  {t('step3.editButton')}
                </button>
                <div style={{ textAlign: 'left' }}>
                  {returnPrice ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      {/* Outbound */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 1 }}>{t('step3.priceOutbound')}</div>
                        <span style={{ fontSize: 38, fontWeight: 900, color: '#FFD700', letterSpacing: '-1px', lineHeight: 1 }}>₪{price?.total}</span>
                      </div>
                      {/* Return */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 1 }}>{t('step3.priceReturn')}</div>
                        <span style={{ fontSize: 38, fontWeight: 900, color: '#FFD700', letterSpacing: '-1px', lineHeight: 1 }}>₪{returnPrice.total}</span>
                        {!returnPrice.diffCity && (
                          <div style={{ fontSize: 9, color: 'var(--txt3)', marginTop: 2 }}>{t('step3.returnFeeNote')}</div>
                        )}
                      </div>
                      {/* Total */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 1 }}>{t('step3.priceTotal')}</div>
                        <span style={{ fontSize: 28, fontWeight: 900, color: '#FFD700', letterSpacing: '-1px', lineHeight: 1 }}>₪{(price?.total ?? 0) + returnPrice.total}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 2 }}>{t('step3.ridePrice')}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 52, fontWeight: 900, color: '#FFD700', letterSpacing: '-2px', lineHeight: 1 }}>
                          ₪{price?.total ?? '—'}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 500 }}>{t('step3.inclVat')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, paddingRight: 4 }}>
                  {t('step3.paymentMethod')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Bit */}
                  <button type="button" onClick={() => setField('payment_method', 'bit')} style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 10, padding: '18px 12px',
                    borderRadius: 18,
                    background: form.payment_method === 'bit' ? 'rgba(42,30,0,0.8)' : 'rgba(255,255,255,0.04)',
                    border: form.payment_method === 'bit' ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: form.payment_method === 'bit' ? '0 0 20px rgba(255,215,0,0.15)' : 'none',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                    {form.payment_method === 'bit' && (
                      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 14, color: '#FFD700' }}>✓</span>
                    )}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #E9C400, #FFD700)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>⚡</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 2 }}>Bit</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>+₪10</div>
                    </div>
                  </button>

                  {/* Cash */}
                  <button type="button" onClick={() => setField('payment_method', 'cash')} style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 10, padding: '18px 12px',
                    borderRadius: 18,
                    background: form.payment_method === 'cash' ? 'rgba(42,30,0,0.8)' : 'rgba(255,255,255,0.04)',
                    border: form.payment_method === 'cash' ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: form.payment_method === 'cash' ? '0 0 20px rgba(255,215,0,0.15)' : 'none',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                    {form.payment_method === 'cash' && (
                      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 14, color: '#FFD700' }}>✓</span>
                    )}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>💵</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: form.payment_method === 'cash' ? 'var(--txt)' : 'var(--txt2)' }}>{t('step3.cashLabel')}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{t('step3.cashSub')}</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Special requests */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 8, paddingRight: 4 }}>
                  {t('step3.specialRequests')}
                </label>
                <textarea rows={2} placeholder={t('step3.specialRequestsPlaceholder')}
                  value={form.special_requests} onChange={e => setField('special_requests', e.target.value)}
                  style={{
                    resize: 'none', width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '12px 14px',
                    color: 'var(--txt)', fontSize: 14, fontFamily: 'inherit',
                    direction: 'rtl',
                  }} />
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
              → {tCommon('back')}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              style={{
                flex: 1, background: 'var(--y)', border: 'none', borderRadius: 14,
                padding: '14px 20px', color: '#000', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {tCommon('next')}
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
              {submitting ? t('submit.submitting') : (
                <>
                  {price ? t('submit.bookNowWithPrice', { price: price.total }) : t('submit.bookNow')}
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

function Stepper({ label, value, min, onChange, icon, sub }: { label: string; value: number; min: number; onChange: (d: number) => void; icon?: string; sub?: string }) {
  return (
    <div style={{
      background: value > min ? 'rgba(255,209,0,0.06)' : 'var(--card2)',
      border: `1px solid ${value > min ? 'rgba(255,209,0,0.25)' : 'var(--border)'}`,
      borderRadius: 12, padding: '10px 8px',
      transition: 'all 0.2s ease', boxSizing: 'border-box',
    }}>
      {icon && <div style={{ fontSize: 24, textAlign: 'center', marginBottom: 2, lineHeight: 1 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: value > min ? 'var(--y)' : 'var(--txt2)', marginBottom: 1, fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--txt3)', textAlign: 'center', marginBottom: 6 }}>{sub}</div>}
      {!sub && <div style={{ marginBottom: 6 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <button type="button" onClick={() => onChange(-1)} disabled={value <= min}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, width: 28, height: 28, cursor: value <= min ? 'not-allowed' : 'pointer', color: value <= min ? 'var(--txt3)' : 'var(--txt)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: value <= min ? 0.4 : 1, transition: 'all 0.15s' }}>−</button>
        <span style={{ fontWeight: 800, fontSize: 18, color: value > min ? 'var(--y)' : 'var(--txt)', minWidth: 20, textAlign: 'center', transition: 'all 0.15s' }}>{value}</span>
        <button type="button" onClick={() => onChange(1)}
          style={{ background: 'var(--y)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#000', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>+</button>
      </div>
    </div>
  )
}

function ExtraIcon({ icon, iconSrc, label, price, note, checked, onChange }: {
  icon?: string; iconSrc?: string; label: string; price: string; note?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{
      display: 'flex', flexDirection: 'column',
      cursor: 'pointer', userSelect: 'none', border: 'none', background: 'transparent', padding: 0,
      width: '100%',
    }}>
      <div style={{
        width: '100%', boxSizing: 'border-box',
        borderRadius: 12, padding: '10px 6px 8px',
        background: checked ? 'rgba(255,209,0,0.10)' : 'var(--card2)',
        border: `2px solid ${checked ? 'var(--y)' : 'var(--border)'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
        boxShadow: checked ? '0 0 14px rgba(255,209,0,0.15)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
        {checked && (
          <div style={{
            position: 'absolute', top: 5, left: 5, width: 16, height: 16,
            background: 'var(--y)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, color: '#000',
          }}>✓</div>
        )}
        {iconSrc
          ? <img src={iconSrc} alt={label} style={{ width: 32, height: 32, objectFit: 'contain', filter: checked ? 'none' : 'grayscale(0.2)' }} />
          : <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
        }
        <div style={{ fontSize: 11, fontWeight: 700, color: checked ? 'var(--y)' : 'var(--txt)', textAlign: 'center', lineHeight: 1.25, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--y)' }}>{price}</div>
        {note && <div style={{ fontSize: 9, color: 'var(--txt3)', textAlign: 'center', lineHeight: 1.3, width: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{note}</div>}
      </div>
    </button>
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
