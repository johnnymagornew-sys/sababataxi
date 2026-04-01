import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['en_route', 'arrived', 'onboard', 'done'] as const
type RideStatus = typeof VALID_STATUSES[number]

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { booking_id, ride_status } = body

    if (!booking_id || !ride_status) {
      return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })
    }

    if (!VALID_STATUSES.includes(ride_status as RideStatus)) {
      return NextResponse.json({ error: 'סטטוס לא חוקי' }, { status: 400 })
    }

    // Authenticate the driver
    const serverClient = await createServerClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'לא מורשה' }, { status: 401 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get driver record
    const { data: driver, error: driverError } = await adminSupabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 403 })
    }

    // Verify this booking belongs to this driver
    const { data: booking, error: bookingError } = await adminSupabase
      .from('bookings')
      .select('id, driver_id, status, customer_phone, tracking_token, pickup_city, pickup_street, pickup_house_number, travel_date, travel_time')
      .eq('id', booking_id)
      .eq('driver_id', driver.id)
      .eq('status', 'claimed')
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'נסיעה לא נמצאה או לא שייכת אליך' }, { status: 403 })
    }

    // Update ride_status (and complete booking if done)
    const updates: Record<string, string> = { ride_status }
    if (ride_status === 'done') updates.status = 'completed'

    const { error: updateError } = await adminSupabase
      .from('bookings')
      .update(updates)
      .eq('id', booking_id)

    if (updateError) {
      return NextResponse.json({ error: 'שגיאה בעדכון' }, { status: 500 })
    }

    // Send WhatsApp notification at key stages
    const waUrl = process.env.WHATSAPP_SERVICE_URL
    if (waUrl && booking.customer_phone) {
      const trackUrl = `https://sababataxi.vercel.app/track/${booking.tracking_token}`
      let waMsg: string | null = null

      if (ride_status === 'en_route') {
        waMsg = `🚗 הנהג שלך בדרך!\n\nעקוב בזמן אמת:\n${trackUrl}\n\n*מוניות סבבה*`
      } else if (ride_status === 'arrived') {
        waMsg = `📍 הנהג הגיע לכתובת האיסוף!\n\nעקוב בזמן אמת:\n${trackUrl}\n\n*מוניות סבבה*`
      } else if (ride_status === 'done') {
        waMsg = `🙏 תודה רבה שנסעתם עם מוניות סבבה!\n\nנשמח לשמוע על חווית הנסיעה שלך — לוקח רק שניות:\n${trackUrl}\n\n*מוניות סבבה*`
      }

      if (waMsg) {
        fetch(`${waUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: booking.customer_phone, message: waMsg }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('ride-status error:', err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
