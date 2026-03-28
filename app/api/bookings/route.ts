import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { calculatePrice } from '@/lib/pricing'
import { TIER_PRICES } from '@/lib/tierPrices'
import { sendBookingConfirmation } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      customer_name, customer_phone, customer_email,
      pickup_city, pickup_street, pickup_house_number,
      travel_date, travel_time,
      passengers, large_luggage, trolley,
      return_trip, return_address, return_flight_number, return_date, return_time,
      extras, special_requests, payment_method,
    } = body

    // Validate required fields (house number optional — Nominatim doesn't always return it)
    if (!customer_name || !customer_phone || !pickup_city || !pickup_street ||
        !travel_date || !travel_time) {
      return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 })
    }

    // Server-side price calculation
    const tierRow = TIER_PRICES[pickup_city]
    const basePrice = tierRow ? tierRow[0] : null
    // Allow unknown cities (small villages) — price will be coordinated by phone
    const effectiveBasePrice = basePrice ?? 0

    const { total: price } = calculatePrice({
      city: pickup_city,
      basePrice: effectiveBasePrice,
      passengers: passengers ?? 1,
      travelDate: travel_date,
      travelTime: travel_time,
      extras: extras ?? {},
      paymentMethod: payment_method ?? 'cash',
    })

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
        pickup_city,
        pickup_street,
        pickup_house_number,
        destination: 'נמל תעופה בן גוריון',
        travel_date,
        travel_time,
        passengers: passengers ?? 1,
        large_luggage: large_luggage ?? 0,
        trolley: trolley ?? 0,
        return_trip: return_trip ?? false,
        return_address: return_address || null,
        return_flight_number: return_flight_number || null,
        return_date: return_date || null,
        return_time: return_time || null,
        extras: extras ?? {},
        special_requests: special_requests || null,
        payment_method: payment_method ?? 'cash',
        price,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'שגיאה בשמירת ההזמנה' }, { status: 500 })
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

    return NextResponse.json({ success: true, id: data.id, price })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
