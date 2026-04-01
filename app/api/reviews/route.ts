import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { booking_id, driver_rating, cleanliness_rating, comment } = await request.json()

    if (!booking_id || !driver_rating || !cleanliness_rating) {
      return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })
    }
    if (driver_rating < 1 || driver_rating > 5 || cleanliness_rating < 1 || cleanliness_rating > 5) {
      return NextResponse.json({ error: 'דירוג לא חוקי' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify booking is completed
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', booking_id)
      .eq('status', 'completed')
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'נסיעה לא נמצאה או לא הסתיימה' }, { status: 403 })
    }

    const { error } = await supabase
      .from('ride_reviews')
      .insert({
        booking_id,
        driver_rating,
        cleanliness_rating,
        comment: comment?.trim() || null,
      })

    if (error) {
      // Unique constraint = already reviewed
      if (error.code === '23505') {
        return NextResponse.json({ error: 'כבר השארת חוות דעת לנסיעה זו' }, { status: 409 })
      }
      return NextResponse.json({ error: 'שגיאה בשמירה' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('reviews error:', err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
