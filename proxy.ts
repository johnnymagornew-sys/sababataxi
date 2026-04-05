import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Rate limiting ────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/bookings':            { max: 5,  windowMs: 60_000 },
  '/api/auth/phone-to-email': { max: 10, windowMs: 60_000 },
  '/api/admin':               { max: 30, windowMs: 60_000 },
  '/api/driver':              { max: 30, windowMs: 60_000 },
  default:                    { max: 60, windowMs: 60_000 },
}
function getLimit(path: string) {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (prefix !== 'default' && path.startsWith(prefix)) return limit
  }
  return RATE_LIMITS.default
}
function isRateLimited(ip: string, path: string): boolean {
  const key = `${ip}:${path.split('/').slice(0, 3).join('/')}`
  const now = Date.now()
  const limit = getLimit(path)
  const entry = rateMap.get(key)
  if (!entry || now > entry.resetAt) { rateMap.set(key, { count: 1, resetAt: now + limit.windowMs }); return false }
  entry.count++
  return entry.count > limit.max
}

// ─── Attack pattern detection ─────────────────────────────────────
const ATTACK_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|truncate|alter|exec)\b.*\b(from|into|table|where|set)\b)/i,
  /(--|;|\/\*|\*\/)/,
  /('|('')|(\%27))/,
  /(or\s+\d+=\d+|and\s+\d+=\d+)/i,
  /(\bsleep\s*\(|\bwaitfor\b)/i,
  /(<script[\s>]|javascript:|on\w+\s*=)/i,
  /(\.\.\/|%2e%2e%2f)/i,
]
function hasAttack(params: URLSearchParams): boolean {
  for (const [, v] of params.entries()) {
    if (ATTACK_PATTERNS.some(p => p.test(v))) return true
  }
  return false
}

// ─── Blocked scanners ─────────────────────────────────────────────
const BLOCKED_UA = /sqlmap|nikto|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|hydra/i

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // 1. Block scanner user-agents
  const ua = request.headers.get('user-agent') ?? ''
  if (BLOCKED_UA.test(ua)) return new NextResponse(null, { status: 403 })

  // 2. Rate limiting on API routes
  if (pathname.startsWith('/api/') && isRateLimited(ip, pathname)) {
    return new NextResponse(JSON.stringify({ error: 'יותר מדי בקשות — נסה שוב בעוד דקה' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }

  // 3. Block SQLi/XSS in query params
  if (hasAttack(searchParams)) {
    return new NextResponse(JSON.stringify({ error: 'בקשה לא תקינה' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 4. Supabase auth — only for protected routes (skip on public pages for speed)
  const isProtected = pathname.startsWith('/driver') || pathname.startsWith('/admin')
  if (!isProtected) return NextResponse.next({ request })

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
