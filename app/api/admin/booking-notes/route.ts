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

  const { error } = await supabase
    .from('bookings')
    .update({ admin_notes: sanitized })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: 'שגיאה בשמירה' }, { status: 500 })
  return NextResponse.json({ success: true })
}
