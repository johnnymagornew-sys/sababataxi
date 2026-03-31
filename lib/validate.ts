/**
 * Input sanitisation & validation helpers.
 * Use these in every API route before inserting to DB.
 */

// Strip HTML tags and trim whitespace
export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return ''
  return val
    .replace(/<[^>]*>/g, '')      // strip HTML tags
    .replace(/['"`;\\]/g, '')     // strip SQL-dangerous chars
    .trim()
    .slice(0, maxLen)
}

// Validate Israeli or international phone
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  // Israeli: 05X-XXXXXXX (10 digits starting with 05)
  if (/^05\d{8}$/.test(digits)) return true
  // International: 7-15 digits
  if (digits.length >= 7 && digits.length <= 15) return true
  return false
}

// Validate date string YYYY-MM-DD
export function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d))
}

// Validate time string HH:MM
export function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t)
}

// Clamp a number within range
export function clampInt(val: unknown, min: number, max: number): number {
  const n = parseInt(String(val), 10)
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

// Validate booking payload and return sanitized object or throw
export function validateBookingInput(body: Record<string, unknown>) {
  const name = sanitizeString(body.customer_name, 100)
  const phone = sanitizeString(body.customer_phone, 20)
  const email = sanitizeString(body.customer_email, 200)
  const pickupCity = sanitizeString(body.pickup_city, 100)
  const pickupStreet = sanitizeString(body.pickup_street, 200)
  const pickupHouse = sanitizeString(body.pickup_house_number, 20)
  const travelDate = sanitizeString(body.travel_date, 10)
  const travelTime = sanitizeString(body.travel_time, 5)
  const specialRequests = sanitizeString(body.special_requests, 500)

  const errors: string[] = []
  if (!name) errors.push('שם חובה')
  if (!phone || !isValidPhone(phone)) errors.push('טלפון לא תקין')
  if (!pickupCity) errors.push('עיר חובה')
  if (!travelDate || !isValidDate(travelDate)) errors.push('תאריך לא תקין')
  if (!travelTime || !isValidTime(travelTime)) errors.push('שעה לא תקינה')

  if (errors.length) throw new Error(errors.join(', '))

  return {
    customer_name: name,
    customer_phone: phone,
    customer_email: email || null,
    pickup_city: pickupCity,
    pickup_street: pickupStreet,
    pickup_house_number: pickupHouse,
    travel_date: travelDate,
    travel_time: travelTime,
    special_requests: specialRequests,
    passengers: clampInt(body.passengers, 1, 16),
    large_luggage: clampInt(body.large_luggage, 0, 20),
    trolley: clampInt(body.trolley, 0, 20),
  }
}
