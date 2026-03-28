import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  // 1. Verify the caller is an admin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: adminRow } = await supabase.from('admins').select('id').eq('user_id', user.id).single()
  if (!adminRow) return NextResponse.json({ error: 'אין הרשאת אדמין' }, { status: 403 })

  // 2. Parse body
  const { email, password, full_name, phone, vehicle_type } = await request.json()

  if (!email || !password || !full_name || !phone) {
    return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY לא מוגדר' }, { status: 500 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 3. Create auth user — pass metadata so trigger can use it
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      phone,
      vehicle_type: vehicle_type || 'regular',
    },
  })

  if (createError) {
    const msg = createError.message.includes('already registered') || createError.message.includes('already been registered')
      ? 'האימייל כבר קיים במערכת'
      : createError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // 4. Upsert driver row (trigger may have already created it — we overwrite with correct data)
  await adminSupabase
    .from('drivers')
    .upsert({
      user_id: newUser.user.id,
      full_name,
      phone,
      vehicle_type: vehicle_type || 'regular',
      is_active: true,
      subscription_active: false,
      credits: 0,
    }, { onConflict: 'user_id' })

  // Even if upsert fails we still return success — user was created
  return NextResponse.json({ success: true, userId: newUser.user.id })
}
