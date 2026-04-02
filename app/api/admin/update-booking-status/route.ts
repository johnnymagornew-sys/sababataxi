import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendBookingApproved } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'
import { buildBookingApproved } from '@/lib/waMessages'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: adminRow } = await supabase.from('admins').select('id').eq('user_id', user.id).single()
  if (!adminRow) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })

  const { bookingId, status } = await request.json()
  if (!bookingId || !status) return NextResponse.json({ error: 'חסרים פרטים' }, { status: 400 })

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await adminSupabase.from('bookings').update({ status }).eq('id', bookingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send approval email to customer
  if (status === 'approved') {
    const { data: booking } = await adminSupabase
      .from('bookings')
      .select('customer_name, customer_email, customer_phone, travel_date, travel_time, pickup_city, locale')
      .eq('id', bookingId)
      .single()

    if (booking?.customer_email) {
      try {
        await sendBookingApproved({
          to: booking.customer_email,
          customerName: booking.customer_name,
          travelDate: booking.travel_date,
          travelTime: booking.travel_time,
          pickupCity: booking.pickup_city,
        })
        console.log('Approval email sent to', booking.customer_email)
      } catch (err) {
        console.error('Email error:', err)
      }
    }
    if (booking?.customer_phone) {
      await sendWhatsApp(booking.customer_phone, buildBookingApproved({
        locale: booking.locale,
        pickup_city: booking.pickup_city,
        travel_date: booking.travel_date,
        travel_time: booking.travel_time,
      }))
    }
  }

  return NextResponse.json({ success: true })
}
