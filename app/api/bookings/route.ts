import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { calculatePrice, getTimeSurcharges } from '@/lib/pricing'
import { TIER_PRICES } from '@/lib/tierPrices'
import { getIntercityPrice } from '@/lib/intercityPrices'
import { sendBookingConfirmation } from '@/lib/email'
import { validateBookingInput, sanitizeString } from '@/lib/validate'
import { buildBookingConfirmation } from '@/lib/waMessages'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate + sanitize all inputs before touching DB
    let sanitized: ReturnType<typeof validateBookingInput>
    try {
      sanitized = validateBookingInput(body)
    } catch (err: unknown) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'קלט לא תקין' }, { status: 400 })
    }

    const {
      customer_name, customer_phone, customer_email,
      pickup_city, pickup_street, pickup_house_number,
      travel_date, travel_time, passengers, large_luggage, trolley, special_requests,
    } = sanitized

    const trip_type = body.trip_type === 'intercity' ? 'intercity' : 'airport'
    const airport_direction: 'to_airport' | 'from_airport' = body.airport_direction === 'from_airport' ? 'from_airport' : 'to_airport'
    const flight_number = sanitizeString(body.flight_number, 20) // flight arriving on (from_airport only)
    const destination_city = sanitizeString(body.destination_city ?? '', 100)
    const destination_street = sanitizeString(body.destination_street ?? '', 200)
    const destination_house_number = sanitizeString(body.destination_house_number ?? '', 20)
    const return_trip = !!body.return_trip
    const return_city = sanitizeString(body.return_city, 100)
    const return_street = sanitizeString(body.return_street, 200)
    const return_house_number = sanitizeString(body.return_house_number, 20)
    const return_flight_number = sanitizeString(body.return_flight_number, 20)
    const return_date = sanitizeString(body.return_date, 10)
    const return_time = sanitizeString(body.return_time, 5)
    const payment_method = body.payment_method === 'bit' ? 'bit' : 'cash'
    const extras = body.extras && typeof body.extras === 'object' ? body.extras : {}
    const locale = ['he', 'en', 'ru', 'ar'].includes(body.locale) ? body.locale : 'he'

    // For from_airport: customer entered THEIR CITY as pickup_city in the form.
    // We swap so the DB stores: pickup = Ben Gurion, destination = their home address.
    const isFromAirport = trip_type === 'airport' && airport_direction === 'from_airport'
    const db_pickup_city         = isFromAirport ? 'נמל תעופה בן גוריון' : pickup_city
    const db_pickup_street       = isFromAirport ? '' : pickup_street
    const db_pickup_house_number = isFromAirport ? '' : pickup_house_number
    const db_destination         = isFromAirport
      ? [pickup_street, pickup_house_number, pickup_city].filter(Boolean).join(' ')
      : trip_type === 'intercity'
        ? [destination_street, destination_house_number, destination_city].filter(Boolean).join(' ')
        : 'נמל תעופה בן גוריון'
    // For from_airport, the incoming flight number goes into return_flight_number (the only flight field we have)
    const db_return_flight_number = isFromAirport ? (flight_number || null) : (return_flight_number || null)

    // Build return address display string
    const return_address = return_city
      ? [return_street, return_house_number, return_city].filter(Boolean).join(' ')
      : null

    // Server-side price calculation
    let price: number
    if (trip_type === 'intercity') {
      const dateTime = new Date(`${travel_date}T${travel_time}`)
      const s = getTimeSurcharges(dateTime)
      const isNight = s.night || s.shabbat
      const intercityBase = getIntercityPrice(pickup_city, destination_city, passengers ?? 1, isNight) ?? 0
      let total = intercityBase
      if (s.peak) total += 20
      if (extras?.additional_stop) total += 20
      if (extras?.nearby_city_stop) total += 40
      if (extras?.child_under4) total += 10
      if (extras?.safety_seat) total += 55
      if (extras?.ski_equipment) total += 20
      if (extras?.bike_rack) total += 50
      if (payment_method === 'bit') total += 10
      price = total
    } else {
      const tierRow = TIER_PRICES[pickup_city]
      const basePrice = tierRow ? tierRow[0] : null
      const effectiveBasePrice = basePrice ?? 0
      const { total } = calculatePrice({
        city: pickup_city, basePrice: effectiveBasePrice, passengers: passengers ?? 1,
        travelDate: travel_date, travelTime: travel_time,
        extras: extras ?? {}, paymentMethod: payment_method ?? 'cash',
      })
      price = total
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        pickup_city: db_pickup_city,
        pickup_street: db_pickup_street,
        pickup_house_number: db_pickup_house_number,
        destination: db_destination,
        travel_date,
        travel_time,
        passengers: passengers ?? 1,
        large_luggage: large_luggage ?? 0,
        trolley: trolley ?? 0,
        return_trip: return_trip ?? false,
        return_address: return_address || null,
        return_flight_number: db_return_flight_number,
        return_date: return_date || null,
        return_time: return_time || null,
        extras: extras ?? {},
        special_requests: special_requests || null,
        payment_method: payment_method ?? 'cash',
        price,
        locale,
        status: 'pending',
      })
      .select('id, tracking_token')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'שגיאה בשמירת ההזמנה' }, { status: 500 })
    }

    // If return trip — create a second booking (airport → home), so two drivers can claim independently
    let returnBookingId: string | null = null
    if (return_trip && return_date) {
      const returnTierRow = TIER_PRICES[return_city]
      const returnBasePrice = returnTierRow ? returnTierRow[0] : 0

      const effectiveReturnTime = return_time || '12:00'
      const { total: returnPrice } = calculatePrice({
        city: return_city || pickup_city,
        basePrice: returnBasePrice,
        passengers: passengers ?? 1,
        travelDate: return_date,
        travelTime: effectiveReturnTime,
        extras: extras ?? {},
        paymentMethod: payment_method ?? 'cash',
      })

      const { data: returnData, error: returnError } = await supabase
        .from('bookings')
        .insert({
          customer_name,
          customer_phone,
          customer_email: customer_email || null,
          pickup_city: 'נמל תעופה בן גוריון',
          pickup_street: '',
          pickup_house_number: '',
          destination: return_address || [pickup_street, pickup_house_number, pickup_city].filter(Boolean).join(' '),
          travel_date: return_date,
          travel_time: effectiveReturnTime,
          passengers: passengers ?? 1,
          large_luggage: large_luggage ?? 0,
          trolley: trolley ?? 0,
          return_trip: false,
          return_flight_number: return_flight_number || null,
          extras: extras ?? {},
          special_requests: special_requests || null,
          payment_method: payment_method ?? 'cash',
          price: returnPrice,
          status: 'pending',
        })
        .select('id')
        .single()

      if (returnError) {
        console.error('Return booking insert error:', returnError)
      } else {
        returnBookingId = returnData.id
      }
    }

    // Send WhatsApp confirmation
    const waUrl = process.env.WHATSAPP_SERVICE_URL
    if (waUrl) {
      try {
        const waMsg = buildBookingConfirmation({
          locale,
          pickup_street,
          pickup_house_number,
          pickup_city,
          travel_date,
          travel_time,
          passengers: passengers ?? 1,
          price,
          payment_method: payment_method ?? 'cash',
          return_trip: return_trip ?? false,
          tracking_token: data.tracking_token,
        })
        await fetch(`${waUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: customer_phone, message: waMsg }),
        })
      } catch (err) {
        console.error('WhatsApp error:', err)
      }
    }

    // Send confirmation email if customer provided email
    if (customer_email) {
      try {
        await sendBookingConfirmation({
          to: customer_email,
          customerName: customer_name,
          pickupCity: pickup_city,
          pickupStreet: pickup_street,
          pickupHouseNumber: pickup_house_number,
          travelDate: travel_date,
          travelTime: travel_time,
          passengers: passengers ?? 1,
          price,
          paymentMethod: payment_method ?? 'cash',
          returnTrip: return_trip ?? false,
        })
        console.log('Confirmation email sent to', customer_email)
      } catch (err) {
        console.error('Email error:', err)
      }
    }

    // Mark lead as converted (fire and forget)
    supabase.from('leads').update({ converted: true }).eq('phone', customer_phone).then(() => {})

    return NextResponse.json({ success: true, id: data.id, price, returnId: returnBookingId })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
