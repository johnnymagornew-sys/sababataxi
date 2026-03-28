import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDriverAssigned } from '@/lib/email'

export async function POST(request: NextRequest) {
  const { bookingId, driverId } = await request.json()

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [bookingRes, driverRes] = await Promise.all([
    supabase.from('bookings').select('customer_name, customer_email, travel_date, travel_time, pickup_city').eq('id', bookingId).single(),
    supabase.from('drivers').select('full_name, phone, vehicle_type, vehicle_number').eq('id', driverId).single(),
  ])

  const booking = bookingRes.data
  const driver = driverRes.data

  if (!booking?.customer_email || !driver) {
    return NextResponse.json({ skipped: true })
  }

  await sendDriverAssigned({
    to: booking.customer_email,
    customerName: booking.customer_name,
    travelDate: booking.travel_date,
    travelTime: booking.travel_time,
    pickupCity: booking.pickup_city,
    driverName: driver.full_name,
    driverPhone: driver.phone,
    vehicleType: driver.vehicle_type,
    vehicleNumber: driver.vehicle_number ?? 'לא צוין',
  }).catch(err => console.error('Email error:', err))

  return NextResponse.json({ success: true })
}
