import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'טוקן לא תקין' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, ride_status,
      pickup_city, pickup_street, pickup_house_number,
      destination, travel_date, travel_time, passengers,
      driver_id, drivers (full_name)
    `)
    .eq('tracking_token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'נסיעה לא נמצאה' }, { status: 404 })
  }

  // Check if review already submitted
  const { data: review } = await supabase
    .from('ride_reviews')
    .select('id')
    .eq('booking_id', data.id)
    .maybeSingle()

  // Return only public-safe fields (no phone, email, price, admin_notes)
  return NextResponse.json({
    id: data.id,
    status: data.status,
    ride_status: data.ride_status,
    pickup_city: data.pickup_city,
    pickup_street: data.pickup_street,
    pickup_house_number: data.pickup_house_number,
    destination: data.destination,
    travel_date: data.travel_date,
    travel_time: data.travel_time,
    passengers: data.passengers,
    driver_first_name: data.driver_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? ((data as any).drivers?.full_name?.split(' ')[0] ?? null)
      : null,
    has_review: !!review,
  })
}
