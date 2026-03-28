import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET() {
  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER,
    from: process.env.SMTP_FROM,
    hasPass: !!process.env.SMTP_PASS,
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: 'eden280406@gmail.com',
      subject: 'בדיקת אימייל – מוניות סבבה',
      html: '<p dir="rtl">זהו מייל בדיקה ממוניות סבבה ✅</p>',
    })

    return NextResponse.json({ success: true, config })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, config }, { status: 500 })
  }
}
