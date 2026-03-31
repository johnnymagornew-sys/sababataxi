import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeString } from '@/lib/validate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { bookingId, notes } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'חסר bookingId' }, { status: 400 })

  const sanitized = sanitizeString(notes ?? '', 1000)

  const { data, error } = await supabase
    .from('bookings')
    .update({ admin_notes: sanitized })
    .eq('id', bookingId)
    .select('id, admin_notes')

  if (error) {
    console.error('booking-notes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'הזמנה לא נמצאה או העמודה לא קיימת' }, { status: 404 })
  }
  return NextResponse.json({ success: true, saved: data[0].admin_notes })
}
