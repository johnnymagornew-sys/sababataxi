import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const serverClient = await createServerClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'לא מורשה' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: driver } = await admin
      .from('drivers').select('id').eq('user_id', user.id).single()
    if (!driver) return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 403 })

    const { data: bookingRows } = await admin
      .from('bookings').select('id').eq('driver_id', driver.id)
    if (!bookingRows?.length) {
      return NextResponse.json({ count: 0, avg: null, avg_driver: null, avg_cleanliness: null })
    }

    const { data: reviews } = await admin
      .from('ride_reviews')
      .select('driver_rating, cleanliness_rating')
      .in('booking_id', bookingRows.map(b => b.id))

    if (!reviews?.length) {
      return NextResponse.json({ count: 0, avg: null, avg_driver: null, avg_cleanliness: null })
    }

    const avgDriver = reviews.reduce((s, r) => s + r.driver_rating, 0) / reviews.length
    const avgClean  = reviews.reduce((s, r) => s + r.cleanliness_rating, 0) / reviews.length

    return NextResponse.json({
      count: reviews.length,
      avg: +((avgDriver + avgClean) / 2).toFixed(1),
      avg_driver: +avgDriver.toFixed(1),
      avg_cleanliness: +avgClean.toFixed(1),
    })
  } catch (err) {
    console.error('my-stats error:', err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
