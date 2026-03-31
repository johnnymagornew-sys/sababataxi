import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  const { phone } = await request.json()
  if (!phone) return NextResponse.json({ error: 'חסר טלפון' }, { status: 400 })

  const input = normalizePhone(phone)

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get all drivers and find matching phone
  const { data: drivers } = await supabase
    .from('drivers')
    .select('user_id, phone')

  const match = drivers?.find(d => normalizePhone(d.phone) === input)
  if (!match) return NextResponse.json({ error: 'מספר טלפון לא נמצא' }, { status: 404 })

  // Get email from auth.users
  const { data: { user }, error } = await supabase.auth.admin.getUserById(match.user_id)
  if (error || !user?.email) return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })

  return NextResponse.json({ email: user.email })
}
