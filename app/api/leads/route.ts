import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeString, isValidPhone } from '@/lib/validate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// POST /api/leads — save partial lead
export async function POST(req: NextRequest) {
  const body = await req.json()
  const name  = sanitizeString(body.name, 100)
  const phone = sanitizeString(body.phone, 20)
  const email = sanitizeString(body.email, 200)

  if (!name || !phone || !isValidPhone(phone)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Upsert by phone so we don't create duplicates on re-visits
  const { error } = await supabase
    .from('leads')
    .upsert({ name, phone, email: email || null, converted: false },
             { onConflict: 'phone', ignoreDuplicates: false })

  if (error) console.error('lead upsert error:', error)
  return NextResponse.json({ ok: true })
}

// PATCH /api/leads — mark converted
export async function PATCH(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 })

  await supabase
    .from('leads')
    .update({ converted: true })
    .eq('phone', sanitizeString(phone, 20))

  return NextResponse.json({ ok: true })
}
