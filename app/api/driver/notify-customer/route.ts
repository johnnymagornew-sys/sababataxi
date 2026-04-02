import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDriverAssigned } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'
import { buildDriverAssigned } from '@/lib/waMessages'

export async function POST(request: NextRequest) {
  const { bookingId, driverId } = await request.json()

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [bookingRes, driverRes] = await Promise.all([
    supabase.from('bookings').select('customer_name, customer_email, customer_phone, travel_date, travel_time, pickup_city, locale').eq('id', bookingId).single(),
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
    const vehicleLabelsHe: Record<string, string> = { regular: 'מונית רגילה', minivan: 'ואן / מיניבוס', luxury: 'יוקרה' }
    const vehicleLabelsEn: Record<string, string> = { regular: 'Regular Taxi', minivan: 'Van / Minibus', luxury: 'Luxury' }
    const vehicleLabelsRu: Record<string, string> = { regular: 'Обычное такси', minivan: 'Вэн / Микроавтобус', luxury: 'Люкс' }
    const vehicleLabelsAr: Record<string, string> = { regular: 'تاكسي عادي', minivan: 'فان / ميني باص', luxury: 'فاخر' }
    const loc = booking.locale ?? 'he'
    const labelMap = loc === 'en' ? vehicleLabelsEn : loc === 'ru' ? vehicleLabelsRu : loc === 'ar' ? vehicleLabelsAr : vehicleLabelsHe
    const vehicleLabel = labelMap[driver.vehicle_type] ?? driver.vehicle_type
    await sendWhatsApp(booking.customer_phone, buildDriverAssigned({
      locale: booking.locale,
      pickup_city: booking.pickup_city,
      travel_date: booking.travel_date,
      travel_time: booking.travel_time,
      driver_name: driver.full_name,
      driver_phone: driver.phone,
      vehicle_label: vehicleLabel,
    }))
  }

  return NextResponse.json({ success: true })
}
