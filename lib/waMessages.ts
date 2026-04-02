/**
 * Multilingual WhatsApp message templates.
 * All customer-facing messages respect the locale stored on the booking.
 */

type Locale = 'he' | 'en' | 'ru' | 'ar'

function safeLocale(raw: string | null | undefined): Locale {
  if (raw === 'en' || raw === 'ru' || raw === 'ar') return raw
  return 'he'
}

function formatDate(dateStr: string, locale: Locale): string {
  const localeMap: Record<Locale, string> = {
    he: 'he-IL', en: 'en-GB', ru: 'ru-RU', ar: 'ar-EG',
  }
  return new Date(dateStr).toLocaleDateString(localeMap[locale], {
    day: 'numeric', month: 'numeric', year: 'numeric',
  })
}

// ─── Booking confirmation (sent on form submit) ───────────────────
export function buildBookingConfirmation(params: {
  locale: string | null
  pickup_street: string
  pickup_house_number: string
  pickup_city: string
  travel_date: string
  travel_time: string
  passengers: number
  price: number
  payment_method: string
  return_trip: boolean
  tracking_token?: string | null
}): string {
  const loc = safeLocale(params.locale)
  const {
    pickup_street, pickup_house_number, pickup_city,
    travel_date, travel_time, passengers, price,
    payment_method, return_trip, tracking_token,
  } = params

  const dateStr = formatDate(travel_date, loc)
  const time = travel_time.slice(0, 5)
  const address = [pickup_street, pickup_house_number, pickup_city].filter(Boolean).join(' ')
  const trackUrl = tracking_token ? `https://sababataxi.vercel.app/track/${tracking_token}` : null

  if (loc === 'en') {
    const payLabel = payment_method === 'bit' ? 'Bit' : 'Cash'
    return (
      `✅ Your booking has been received!\n\n` +
      `📍 Address: ${address}\n` +
      `📅 Date: ${dateStr} at ${time}\n` +
      `👥 Passengers: ${passengers}\n` +
      `💰 Price: ₪${price}\n` +
      `💳 Payment: ${payLabel} to driver\n` +
      (return_trip ? `✈️ Includes return from airport\n` : '') +
      (trackUrl ? `\n🔍 Real-time tracking:\n${trackUrl}\n` : '') +
      `\nDriver will confirm shortly 🚕\n` +
      `*Sababa Taxi*`
    )
  }

  if (loc === 'ru') {
    const payLabel = payment_method === 'bit' ? 'Bit' : 'Наличные'
    return (
      `✅ Ваш заказ принят!\n\n` +
      `📍 Адрес: ${address}\n` +
      `📅 Дата: ${dateStr} в ${time}\n` +
      `👥 Пассажиры: ${passengers}\n` +
      `💰 Цена: ₪${price}\n` +
      `💳 Оплата: ${payLabel} водителю\n` +
      (return_trip ? `✈️ Включает возврат из аэропорта\n` : '') +
      (trackUrl ? `\n🔍 Отслеживание в реальном времени:\n${trackUrl}\n` : '') +
      `\nВодитель подтвердит в ближайшее время 🚕\n` +
      `*Sababa Taxi*`
    )
  }

  if (loc === 'ar') {
    const payLabel = payment_method === 'bit' ? 'بيت' : 'نقداً'
    return (
      `✅ تم استلام حجزك!\n\n` +
      `📍 العنوان: ${address}\n` +
      `📅 التاريخ: ${dateStr} الساعة ${time}\n` +
      `👥 الركاب: ${passengers}\n` +
      `💰 السعر: ₪${price}\n` +
      `💳 الدفع: ${payLabel} للسائق\n` +
      (return_trip ? `✈️ يشمل العودة من المطار\n` : '') +
      (trackUrl ? `\n🔍 تتبع مباشر:\n${trackUrl}\n` : '') +
      `\nسيؤكد معك السائق قريباً 🚕\n` +
      `*سبابا تاكسي*`
    )
  }

  // he (default)
  const payLabel = payment_method === 'bit' ? 'ביט' : 'מזומן'
  return (
    `✅ ההזמנה שלך התקבלה!\n\n` +
    `📍 כתובת: ${address}\n` +
    `📅 תאריך: ${dateStr} בשעה ${time}\n` +
    `👥 נוסעים: ${passengers}\n` +
    `💰 מחיר: ₪${price}\n` +
    `💳 תשלום: ${payLabel} לנהג\n` +
    (return_trip ? `✈️ כולל חזרה מהשדה\n` : '') +
    (trackUrl ? `\n🔍 מעקב נסיעה בזמן אמת:\n${trackUrl}\n` : '') +
    `\nנהג יאשר איתך בקרוב 🚕\n` +
    `*מוניות סבבה*`
  )
}

// ─── Booking approved (sent by admin) ────────────────────────────
export function buildBookingApproved(params: {
  locale: string | null
  pickup_city: string
  travel_date: string
  travel_time: string
}): string {
  const loc = safeLocale(params.locale)
  const { pickup_city, travel_date, travel_time } = params
  const dateStr = formatDate(travel_date, loc)
  const time = travel_time.slice(0, 5)

  if (loc === 'en') return (
    `✅ Your booking is confirmed!\n\n` +
    `Your trip from ${pickup_city} to Ben Gurion Airport\n` +
    `📅 ${dateStr} at ${time}\n\n` +
    `We are finding a driver for you — we'll update you as soon as one is assigned 🚕\n` +
    `*Sababa Taxi*`
  )

  if (loc === 'ru') return (
    `✅ Ваш заказ подтверждён!\n\n` +
    `Ваша поездка из ${pickup_city} в аэропорт Бен Гурион\n` +
    `📅 ${dateStr} в ${time}\n\n` +
    `Мы ищем для вас водителя — уведомим, как только будет назначен 🚕\n` +
    `*Sababa Taxi*`
  )

  if (loc === 'ar') return (
    `✅ تم تأكيد حجزك!\n\n` +
    `رحلتك من ${pickup_city} إلى مطار بن غوريون\n` +
    `📅 ${dateStr} الساعة ${time}\n\n` +
    `نحن نبحث لك عن سائق — سنبلغك فور تعيينه 🚕\n` +
    `*سبابا تاكسي*`
  )

  return (
    `✅ הזמנתך אושרה!\n\n` +
    `הנסיעה שלך מ-${pickup_city} לנמל תעופה בן גוריון\n` +
    `📅 ${dateStr} בשעה ${time}\n\n` +
    `אנו מחפשים עבורך נהג — נעדכן אותך ברגע שנהג ישוריין 🚕\n` +
    `*מוניות סבבה*`
  )
}

// ─── Driver assigned (sent when admin assigns driver) ─────────────
export function buildDriverAssigned(params: {
  locale: string | null
  pickup_city: string
  travel_date: string
  travel_time: string
  driver_name: string
  driver_phone: string
  vehicle_label: string
}): string {
  const loc = safeLocale(params.locale)
  const { pickup_city, travel_date, travel_time, driver_name, driver_phone, vehicle_label } = params
  const dateStr = formatDate(travel_date, loc)
  const time = travel_time.slice(0, 5)

  if (loc === 'en') return (
    `🚕 A driver has taken your ride!\n\n` +
    `${dateStr} at ${time} from ${pickup_city}\n\n` +
    `👤 Name: ${driver_name}\n` +
    `📞 Phone: ${driver_phone}\n` +
    `🚗 Vehicle: ${vehicle_label}\n\n` +
    `The driver will contact you before the ride.\n` +
    `*Sababa Taxi*`
  )

  if (loc === 'ru') return (
    `🚕 Водитель принял вашу поездку!\n\n` +
    `${dateStr} в ${time} из ${pickup_city}\n\n` +
    `👤 Имя: ${driver_name}\n` +
    `📞 Телефон: ${driver_phone}\n` +
    `🚗 Транспорт: ${vehicle_label}\n\n` +
    `Водитель свяжется с вами перед поездкой.\n` +
    `*Sababa Taxi*`
  )

  if (loc === 'ar') return (
    `🚕 سائق قبل رحلتك!\n\n` +
    `${dateStr} الساعة ${time} من ${pickup_city}\n\n` +
    `👤 الاسم: ${driver_name}\n` +
    `📞 الهاتف: ${driver_phone}\n` +
    `🚗 المركبة: ${vehicle_label}\n\n` +
    `سيتواصل معك السائق قبل الرحلة.\n` +
    `*سبابا تاكسي*`
  )

  return (
    `🚕 נהג קיבל את הנסיעה שלך!\n\n` +
    `${dateStr} בשעה ${time} מ-${pickup_city}\n\n` +
    `👤 שם: ${driver_name}\n` +
    `📞 טלפון: ${driver_phone}\n` +
    `🚗 רכב: ${vehicle_label}\n\n` +
    `הנהג ייצור איתך קשר לפני הנסיעה.\n` +
    `*מוניות סבבה*`
  )
}

// ─── Ride status updates (en_route / arrived / done) ─────────────
export function buildRideStatus(params: {
  locale: string | null
  ride_status: 'en_route' | 'arrived' | 'done'
  tracking_url: string
}): string | null {
  const loc = safeLocale(params.locale)
  const { ride_status, tracking_url } = params
  const brand = loc === 'ar' ? '*سبابا تاكسي*' : '*Sababa Taxi*' // all non-HE use Latin brand

  if (loc === 'en') {
    if (ride_status === 'en_route')
      return `🚗 Your driver is on the way!\n\nTrack in real time:\n${tracking_url}\n\n*Sababa Taxi*`
    if (ride_status === 'arrived')
      return `📍 Your driver has arrived at the pickup address!\n\nTrack in real time:\n${tracking_url}\n\n*Sababa Taxi*`
    if (ride_status === 'done')
      return `🙏 Thank you for riding with Sababa Taxi!\n\nWe'd love to hear about your experience — takes just seconds:\n${tracking_url}\n\n*Sababa Taxi*`
  }

  if (loc === 'ru') {
    if (ride_status === 'en_route')
      return `🚗 Ваш водитель едет к вам!\n\nОтслеживайте в реальном времени:\n${tracking_url}\n\n*Sababa Taxi*`
    if (ride_status === 'arrived')
      return `📍 Ваш водитель прибыл на место посадки!\n\nОтслеживайте в реальном времени:\n${tracking_url}\n\n*Sababa Taxi*`
    if (ride_status === 'done')
      return `🙏 Спасибо, что воспользовались Sababa Taxi!\n\nРасскажите нам о вашей поездке — займёт всего секунды:\n${tracking_url}\n\n*Sababa Taxi*`
  }

  if (loc === 'ar') {
    if (ride_status === 'en_route')
      return `🚗 سائقك في الطريق إليك!\n\nتابع مباشرة:\n${tracking_url}\n\n${brand}`
    if (ride_status === 'arrived')
      return `📍 وصل سائقك إلى عنوان الاستلام!\n\nتابع مباشرة:\n${tracking_url}\n\n${brand}`
    if (ride_status === 'done')
      return `🙏 شكراً لاستخدامك سبابا تاكسي!\n\nيسعدنا سماع تجربتك — يستغرق ثوانٍ فقط:\n${tracking_url}\n\n${brand}`
  }

  // he (default)
  if (ride_status === 'en_route')
    return `🚗 הנהג שלך בדרך!\n\nעקוב בזמן אמת:\n${tracking_url}\n\n*מוניות סבבה*`
  if (ride_status === 'arrived')
    return `📍 הנהג הגיע לכתובת האיסוף!\n\nעקוב בזמן אמת:\n${tracking_url}\n\n*מוניות סבבה*`
  if (ride_status === 'done')
    return `🙏 תודה רבה שנסעתם עם מוניות סבבה!\n\nנשמח לשמוע על חווית הנסיעה שלך — לוקח רק שניות:\n${tracking_url}\n\n*מוניות סבבה*`

  return null
}
