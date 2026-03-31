import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'חסר bookingId' }, { status: 400 })

  // Fetch booking to get driver_id and price
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, driver_id, price, status')
    .eq('id', bookingId)
    .single()

  if (fetchErr || !booking) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 })
  if (booking.status !== 'claimed') return NextResponse.json({ error: 'הנסיעה לא בסטטוס "שוריין"' }, { status: 400 })
  if (!booking.driver_id) return NextResponse.json({ error: 'אין נהג משויך' }, { status: 400 })

  const driverId = booking.driver_id

  // Find the actual commission that was deducted when the driver claimed the ride
  const { data: txRow } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('driver_id', driverId)
    .eq('booking_id', bookingId)
    .lt('amount', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // refundAmount = absolute value of the deducted commission
  const refundAmount = txRow ? Math.abs(txRow.amount) : 0

  // 1. Unassign driver + revert status to approved
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ driver_id: null, status: 'approved' })
    .eq('id', bookingId)

  if (updateErr) return NextResponse.json({ error: 'שגיאה בעדכון הזמנה' }, { status: 500 })

  // 2. Refund credits to driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('credits')
    .eq('id', driverId)
    .single()

  if (driver) {
    await supabase
      .from('drivers')
      .update({ credits: (driver.credits ?? 0) + refundAmount })
      .eq('id', driverId)

    // Log the refund
    await supabase.from('credit_transactions').insert({
      driver_id: driverId,
      amount: refundAmount,
      notes: `החזר קרדיט — נסיעה הוסרה ידנית על ידי מנהל (הזמנה ${bookingId.slice(0, 8)})`,
    })
  }

  return NextResponse.json({ success: true, refunded: refundAmount })
}
