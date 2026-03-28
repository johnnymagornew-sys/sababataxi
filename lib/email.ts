import { Resend } from 'resend'

// Sender — change to your verified domain email once added in Resend dashboard
const FROM = 'מוניות סבבה <onboarding@resend.dev>'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendBookingConfirmation(opts: {
  to: string
  customerName: string
  pickupCity: string
  pickupStreet: string
  pickupHouseNumber: string
  travelDate: string
  travelTime: string
  passengers: number
  price: number
  paymentMethod: string
  returnTrip: boolean
}) {
  const payment = opts.paymentMethod === 'bit' ? 'ביט' : 'מזומן'
  const time = opts.travelTime?.slice(0, 5) ?? ''

  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `✅ הזמנתך התקבלה – ${opts.travelDate} ${time}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #0E0E0E; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #FFD100; margin: 0; font-size: 22px;">מוניות סבבה</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
          <h2 style="margin: 0 0 20px; font-size: 20px;">שלום ${opts.customerName},</h2>
          <p style="color: #555; margin: 0 0 20px;">הזמנתך התקבלה בהצלחה! נציג יאשר אותה בקרוב.</p>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 14px; font-size: 15px; color: #444;">פרטי הנסיעה</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
              <tr><td style="padding: 6px 0; color: #888;">מוצא</td><td style="font-weight: bold;">${opts.pickupCity}, ${opts.pickupStreet} ${opts.pickupHouseNumber}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">יעד</td><td style="font-weight: bold;">נמל תעופה בן גוריון</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">תאריך</td><td style="font-weight: bold;">${opts.travelDate}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">שעה</td><td style="font-weight: bold;">${time}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">נוסעים</td><td style="font-weight: bold;">${opts.passengers}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">תשלום</td><td style="font-weight: bold;">${payment}</td></tr>
            </table>
          </div>

          <div style="background: #FFD100; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
            <div style="font-size: 13px; color: #555;">מחיר משוער</div>
            <div style="font-size: 32px; font-weight: 900; color: #0E0E0E;">₪${opts.price}</div>
          </div>

          ${opts.returnTrip ? '<p style="color: #555; font-size: 14px;">✈️ כולל נסיעת חזרה מהשדה</p>' : ''}

          <p style="color: #888; font-size: 13px; margin: 0;">שאלות? צור קשר בטלפון.</p>
        </div>
      </div>
    `,
  })
}

export async function sendDriverAssigned(opts: {
  to: string
  customerName: string
  travelDate: string
  travelTime: string
  pickupCity: string
  driverName: string
  driverPhone: string
  vehicleType: string
  vehicleNumber: string
}) {
  const time = opts.travelTime?.slice(0, 5) ?? ''
  const vehicleLabels: Record<string, string> = {
    regular: 'מונית רגילה', minivan: 'ואן / מיניבוס', luxury: 'יוקרה',
  }
  const vehicleLabel = vehicleLabels[opts.vehicleType] ?? opts.vehicleType

  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `🚕 נהג שויין לנסיעתך – ${opts.travelDate} ${time}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #0E0E0E; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #FFD100; margin: 0; font-size: 22px;">מוניות סבבה</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
          <h2 style="margin: 0 0 16px;">שלום ${opts.customerName} 👋</h2>
          <p style="color: #555; margin: 0 0 20px;">נהג שויין לנסיעתך מ-<strong>${opts.pickupCity}</strong> בתאריך <strong>${opts.travelDate}</strong> בשעה <strong>${time}</strong>.</p>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 14px; font-size: 15px; color: #444;">פרטי הנהג</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
              <tr><td style="padding: 6px 0; color: #888;">שם</td><td style="font-weight: bold;">${opts.driverName}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">טלפון</td><td style="font-weight: bold; direction: ltr;">${opts.driverPhone}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">סוג רכב</td><td style="font-weight: bold;">${vehicleLabel}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">מספר רכב</td><td style="font-weight: bold; direction: ltr;">${opts.vehicleNumber}</td></tr>
            </table>
          </div>
          <p style="color: #888; font-size: 13px;">הנהג ייצור איתך קשר לפני הנסיעה.</p>
        </div>
      </div>
    `,
  })
}

export async function sendBookingApproved(opts: {
  to: string
  customerName: string
  travelDate: string
  travelTime: string
  pickupCity: string
}) {
  const time = opts.travelTime?.slice(0, 5) ?? ''

  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `🚕 הזמנתך אושרה! – ${opts.travelDate} ${time}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #0E0E0E; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #FFD100; margin: 0; font-size: 22px;">מוניות סבבה</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
          <h2 style="margin: 0 0 16px;">שלום ${opts.customerName} 👋</h2>
          <div style="background: #27AE6011; border: 1px solid #27AE60; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 8px;">✅</div>
            <div style="font-size: 18px; font-weight: 800; color: #27AE60;">הזמנתך אושרה!</div>
          </div>
          <p style="color: #555;">הנסיעה שלך מ-<strong>${opts.pickupCity}</strong> לנמל תעופה בן גוריון בתאריך <strong>${opts.travelDate}</strong> בשעה <strong>${time}</strong> מאושרת.</p>
          <p style="color: #888; font-size: 13px;">נהג ייצור איתך קשר לפני הנסיעה.</p>
        </div>
      </div>
    `,
  })
}
