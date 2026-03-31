import { NextRequest, NextResponse } from 'next/server'

// ─── Rate limiting (in-memory per edge instance) ──────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/bookings':                   { max: 5,  windowMs: 60_000 },  // 5 bookings/min
  '/api/auth/phone-to-email':        { max: 10, windowMs: 60_000 },  // 10 logins/min
  '/api/admin':                      { max: 30, windowMs: 60_000 },
  '/api/driver':                     { max: 30, windowMs: 60_000 },
  default:                           { max: 60, windowMs: 60_000 },
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

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + limit.windowMs })
    return false
  }
  entry.count++
  if (entry.count > limit.max) return true
  return false
}

// ─── SQLi / XSS pattern detection ────────────────────────────────
const ATTACK_PATTERNS = [
  // SQL Injection
  /(\b(union|select|insert|update|delete|drop|truncate|alter|create|exec|execute)\b.*\b(from|into|table|where|set)\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/,
  /('|('')|(\%27)|(\%2527))/,   // single quotes encoded
  /(or\s+\d+=\d+|and\s+\d+=\d+)/i,  // OR 1=1, AND 1=1
  /(\bsleep\s*\(|\bwaitfor\b|\bbenchmark\s*\()/i,  // time-based blind
  // XSS
  /(<script[\s>]|javascript:|on\w+\s*=|<iframe|<object|<embed)/i,
  /(%3cscript|%3c%2fscript|%3ciframe)/i,
  // Path traversal
  /(\.\.\/|\.\.\\|%2e%2e%2f|%252e%252e)/i,
]

function containsAttackPattern(value: string): boolean {
  return ATTACK_PATTERNS.some(p => p.test(value))
}

function scanParams(params: URLSearchParams): boolean {
  for (const [, v] of params.entries()) {
    if (containsAttackPattern(v)) return true
  }
  return false
}

// ─── Middleware ───────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // 1. Rate limiting (API routes only)
  if (pathname.startsWith('/api/')) {
    if (isRateLimited(ip, pathname)) {
      return new NextResponse(JSON.stringify({ error: 'יותר מדי בקשות — נסה שוב בעוד דקה' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  // 2. Scan URL query params for attack patterns
  if (scanParams(searchParams)) {
    return new NextResponse(JSON.stringify({ error: 'בקשה לא תקינה' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Block suspicious User-Agents (scanners, bots)
  const ua = req.headers.get('user-agent') ?? ''
  const blockedAgents = /sqlmap|nikto|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|hydra/i
  if (blockedAgents.test(ua)) {
    return new NextResponse(null, { status: 403 })
  }

  // 4. Block direct access to internal API routes from non-server origins
  // (admin routes require a valid session — handled by route logic, but add extra check)
  const origin = req.headers.get('origin')
  if (pathname.startsWith('/api/admin') && origin && !origin.includes('sababataxi')) {
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
