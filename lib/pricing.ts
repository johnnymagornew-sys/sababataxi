import type { BookingExtras } from '@/types/database'

// Ben Gurion Airport coordinates for suncalc (server-side only)
export const BEN_GURION_LAT = 31.9997
export const BEN_GURION_LNG = 34.8854

/**
 * Time-based surcharges
 */
export function getTimeSurcharges(date: Date): { night: boolean; peak: boolean; shabbat: boolean } {
  const hour = date.getHours()
  const minute = date.getMinutes()
  const day = date.getDay() // 0=Sun, 5=Fri, 6=Sat
  const totalMinutes = hour * 60 + minute

  // Night surcharge: 20:31 – 05:59
  const night =
    totalMinutes >= 20 * 60 + 31 || totalMinutes <= 5 * 60 + 59

  // Peak hours: Sun-Thu 06:40–08:30 and 15:01–18:59
  const isPeakDay = day >= 0 && day <= 4
  const morningPeak = totalMinutes >= 6 * 60 + 40 && totalMinutes <= 8 * 60 + 30
  const eveningPeak = totalMinutes >= 15 * 60 + 1 && totalMinutes <= 18 * 60 + 59
  const peak = isPeakDay && (morningPeak || eveningPeak)

  // Shabbat: Friday 16:31 – Saturday 19:00
  const fridayShabbat = day === 5 && totalMinutes >= 16 * 60 + 31
  const saturdayShabbat = day === 6 && totalMinutes <= 19 * 60
  const shabbat = fridayShabbat || saturdayShabbat

  return { night, peak, shabbat }
}

/**
 * Calculate total price from base + time + extras
 */
export function calculatePrice(params: {
  basePrice: number
  travelDate: string
  travelTime: string
  extras: BookingExtras
  paymentMethod: 'cash' | 'bit'
}): { total: number; breakdown: PriceBreakdown } {
  const { basePrice, travelDate, travelTime, extras, paymentMethod } = params

  const dateTime = new Date(`${travelDate}T${travelTime}`)
  const surcharges = getTimeSurcharges(dateTime)

  let total = basePrice
  const breakdown: PriceBreakdown = {
    base: basePrice,
    night: 0,
    peak: 0,
    shabbat: 0,
    additionalStop: 0,
    nearbyCityStop: 0,
    childUnder4: 0,
    safetySeat: 0,
    skiEquipment: 0,
    bikeRack: 0,
    bitPayment: 0,
  }

  if (surcharges.night) { breakdown.night = 20; total += 20 }
  if (surcharges.peak) { breakdown.peak = 20; total += 20 }
  if (surcharges.shabbat) { breakdown.shabbat = 15; total += 15 }

  if (extras.additional_stop) { breakdown.additionalStop = 20; total += 20 }
  if (extras.nearby_city_stop) { breakdown.nearbyCityStop = 40; total += 40 }
  if (extras.child_under4) { breakdown.childUnder4 = 10; total += 10 }
  if (extras.safety_seat) { breakdown.safetySeat = 55; total += 55 } // midpoint of 40–70₪
  if (extras.ski_equipment) { breakdown.skiEquipment = 20; total += 20 }
  if (extras.bike_rack) { breakdown.bikeRack = 50; total += 50 }

  if (paymentMethod === 'bit') { breakdown.bitPayment = 10; total += 10 }

  return { total, breakdown }
}

export interface PriceBreakdown {
  base: number
  night: number
  peak: number
  shabbat: number
  additionalStop: number
  nearbyCityStop: number
  childUnder4: number
  safetySeat: number
  skiEquipment: number
  bikeRack: number
  bitPayment: number
}
