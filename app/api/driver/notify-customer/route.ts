import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDriverAssigned } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  const { bookingId, driverId } = await request.json()

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [bookingRes, driverRes] = await Promise.all([
    supabase.from('bookings').select('customer_name, customer_email, customer_phone, travel_date, travel_time, pickup_city').eq('id', bookingId).single(),
    supabase.from('drivers').select('full_name, phone, vehicle_type, vehicle_number').eq('id', driverId).single(),
  ])

  const booking = bookingRes.data
  const driver = driverRes.data

  if (!booking || !driver) {
    return NextResponse.json({ skipped: true })
  }

  if (booking.customer_email) {
    try {
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
      })
      console.log('Driver assigned email sent to', booking.customer_email)
    } catch (err) {
      console.error('Email error:', err)
    }
  }

  if (booking.customer_phone) {
    const time = booking.travel_time?.slice(0, 5) ?? ''
    const dateStr = new Date(booking.travel_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' })
    const vehicleLabels: Record<string, string> = { regular: 'מונית רגילה', minivan: 'ואן / מיניבוס', luxury: 'יוקרה' }
    const vehicleLabel = vehicleLabels[driver.vehicle_type] ?? driver.vehicle_type
    await sendWhatsApp(booking.customer_phone,
      `🚕 נהג קיבל את הנסיעה שלך!\n\n` +
      `${dateStr} בשעה ${time} מ-${booking.pickup_city}\n\n` +
      `👤 שם: ${driver.full_name}\n` +
      `📞 טלפון: ${driver.phone}\n` +
      `🚗 רכב: ${vehicleLabel}\n\n` +
      `הנהג ייצור איתך קשר לפני הנסיעה.\n` +
      `*מוניות סבבה*`
    )
  }

  return NextResponse.json({ success: true })
}
