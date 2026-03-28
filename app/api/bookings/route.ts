import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePrice } from '@/lib/pricing'

const CITY_PRICES: Record<string, number> = {
  'תל אביב': 145, 'רמת גן': 145, 'גבעתיים': 145, 'בני ברק': 145,
  'פתח תקווה': 120, 'ראשון לציון': 120, 'רחובות': 120, 'נס ציונה': 120,
  'לוד': 100, 'רמלה': 100, 'שוהם': 100, 'יהוד': 90,
  'קריית אונו': 110, 'אור יהודה': 100, 'אזור': 100,
  'בת ים': 140, 'חולון': 135,
  'הרצליה': 155, 'רעננה': 155, 'כפר סבא': 155,
  'הוד השרון': 150, 'נתניה': 175, 'ראש העין': 130,
  'אלעד': 125, 'מודיעין': 130, 'מודיעין עילית': 130,
  'רמת השרון': 150, 'כפר יונה': 155, 'אור עקיבא': 195,
  'טייבה': 145, 'קלנסווה': 145, 'טירה': 145,
  'חדרה': 200, 'זכרון יעקב': 220, 'פרדס חנה': 210, 'בנימינה': 210, 'עמק חפר': 200,
  'ירושלים': 240, 'בית שמש': 200, 'מעלה אדומים': 260,
  'גבעת זאב': 250, 'ביתר עילית': 220, 'אפרת': 260,
  'באר שבע': 340, 'אשדוד': 180, 'אשקלון': 210, 'קריית גת': 220,
  'קריית מלאכי': 230, 'גדרה': 160, 'יבנה': 150, 'נתיבות': 280, 'שדרות': 270, 'אילת': 800,
  'חיפה': 400, 'קריית ים': 400, 'קריית ביאליק': 390,
  'קריית מוצקין': 390, 'קריית אתא': 395, 'נשר': 400,
  'טירת כרמל': 390, 'עכו': 440, 'נהריה': 460, 'כרמיאל': 420,
  'נצרת': 400, 'נצרת עילית': 400, 'עפולה': 380, 'בית שאן': 420,
  'טבריה': 430, 'צפת': 470, 'קצרין': 500, 'יוקנעם': 380,
  'כפר יסיף': 440, 'מגדל העמק': 380,
  'אריאל': 160, 'אלפי מנשה': 165, 'עמנואל': 155, 'קדומים': 165,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      customer_name, customer_phone, customer_email,
      pickup_city, pickup_street, pickup_house_number,
      travel_date, travel_time,
      passengers, large_luggage, trolley,
      return_trip, return_address, return_flight_number, return_date, return_time,
      extras, special_requests, payment_method,
    } = body

    // Validate required fields
    if (!customer_name || !customer_phone || !pickup_city || !pickup_street ||
        !pickup_house_number || !travel_date || !travel_time) {
      return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 })
    }

    // Server-side price calculation (cannot trust client)
    const basePrice = CITY_PRICES[pickup_city]
    if (!basePrice) {
      return NextResponse.json({ error: 'עיר לא מזוהה' }, { status: 400 })
    }

    const { total: price } = calculatePrice({
      basePrice,
      travelDate: travel_date,
      travelTime: travel_time,
      extras: extras ?? {},
      paymentMethod: payment_method ?? 'cash',
    })

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        pickup_city,
        pickup_street,
        pickup_house_number,
        destination: 'נמל תעופה בן גוריון',
        travel_date,
        travel_time,
        passengers: passengers ?? 1,
        large_luggage: large_luggage ?? 0,
        trolley: trolley ?? 0,
        return_trip: return_trip ?? false,
        return_address: return_address || null,
        return_flight_number: return_flight_number || null,
        return_date: return_date || null,
        return_time: return_time || null,
        extras: extras ?? {},
        special_requests: special_requests || null,
        payment_method: payment_method ?? 'cash',
        price,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'שגיאה בשמירת ההזמנה' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id, price })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
