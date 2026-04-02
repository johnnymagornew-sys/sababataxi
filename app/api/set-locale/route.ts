import { NextResponse } from 'next/server'

const valid = ['he', 'en', 'ru', 'ar']

export async function POST(req: Request) {
  const { locale } = await req.json()
  if (!valid.includes(locale)) {
    return NextResponse.json({ error: 'invalid locale' }, { status: 400 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return res
}
