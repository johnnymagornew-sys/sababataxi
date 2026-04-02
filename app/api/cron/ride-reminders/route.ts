import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Verify request is from Vercel Cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all claimed rides that haven't started yet, with driver info
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, travel_date, travel_time, pickup_city, pickup_street, pickup_house_number, destination, passengers, reminder_60_sent, reminder_15_sent, drivers(full_name, phone)')
    .eq('status', 'claimed')
    .is('ride_status', null)

  if (error) {
    console.error('Cron fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sent60: string[] = []
  const sent15: string[] = []
  const now = Date.now()

  for (const booking of bookings ?? []) {
    const driver = booking.drivers as { full_name: string; phone: string } | null
    if (!driver?.phone) continue

    // Parse ride time in Israel timezone (UTC+3 summer / UTC+2 winter)
    // Use +02:00 as safe default (Supabase stores date/time without timezone)
    const rideAt = new Date(`${booking.travel_date}T${booking.travel_time}+03:00`)
    const minsUntil = (rideAt.getTime() - now) / 60000

    const pickup = [booking.pickup_street, booking.pickup_house_number, booking.pickup_city]
      .filter(Boolean).join(' ')
    const timeStr = (booking.travel_time as string).slice(0, 5)

    // 1-hour reminder
    if (minsUntil > 50 && minsUntil < 70 && !booking.reminder_60_sent) {
      await sendWhatsApp(
        driver.phone,
        `⏰ תזכורת נסיעה!\n\nשלום ${driver.full_name}, יש לך נסיעה בעוד ~שעה 🚕\n\n📍 איסוף: ${pickup}\n🎯 יעד: ${booking.destination}\n🕐 שעה: ${timeStr}\n👥 נוסעים: ${booking.passengers}\n\n*מוניות סבבה*`
      )
      await supabase.from('bookings').update({ reminder_60_sent: true }).eq('id', booking.id)
      sent60.push(booking.id)
    }

    // 15-minute reminder
    if (minsUntil > 10 && minsUntil < 20 && !booking.reminder_15_sent) {
      await sendWhatsApp(
        driver.phone,
        `🚨 נסיעה בעוד 15 דקות!\n\nשלום ${driver.full_name}, הנסיעה שלך מתחילה בקרוב.\nאנא סמן ״בדרך ללקוח״ בדאשבורד:\nhttps://sababataxi.vercel.app/driver/dashboard\n\n📍 ${pickup}\n🕐 ${timeStr}\n\n*מוניות סבבה*`
      )
      await supabase.from('bookings').update({ reminder_15_sent: true }).eq('id', booking.id)
      sent15.push(booking.id)
    }
  }

  return NextResponse.json({
    checked: bookings?.length ?? 0,
    sent_60min: sent60,
    sent_15min: sent15,
  })
}
