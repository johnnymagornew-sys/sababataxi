import { NextResponse } from 'next/server'

export const maxDuration = 15 // allow up to 15s for external API calls

interface FlightStatus {
  flight: string
  status: string          // scheduled | en-route | landed | cancelled | diverted | unknown
  arr_time: string | null // scheduled arrival (UTC)
  arr_actual: string | null  // actual arrival (UTC)
  arr_estimated: string | null // estimated arrival (UTC)
  delayed: number | null  // minutes delayed
}

// In-memory cache per flight number — 2 min TTL (matches client refresh interval)
const cache = new Map<string, { data: FlightStatus; fetchedAt: number }>()
const CACHE_MS = 2 * 60 * 1000

// IATA airline code → ICAO 3-letter code (for ADS-B callsign lookup)
const IATA_TO_ICAO: Record<string, string> = {
  // Israeli carriers
  LY: 'ELY', '6H': 'ISR', IZ: 'AIZ',
  // European low-cost
  FR: 'RYR', U2: 'EZY', W6: 'WZZ', PC: 'PGT', VY: 'VLG', V7: 'BRQ',
  TO: 'FPO', BY: 'TOM', X3: 'TUI', HV: 'TRA', SN: 'BEL', TU: 'TAR',
  // Middle East & Gulf
  EK: 'UAE', QR: 'QTR', ET: 'ETH', FZ: 'FDB', G9: 'ABY', WY: 'OMA',
  XY: 'NAS', SV: 'SVA', GF: 'GFA', ME: 'MEA', RJ: 'RJA', MS: 'MSR',
  // European legacy
  TK: 'THY', LH: 'DLH', BA: 'BAW', AF: 'AFR', KL: 'KLM', OS: 'AUA',
  AY: 'FIN', SK: 'SAS', IB: 'IBE', LO: 'LOT', OK: 'CSA', AZ: 'ITY',
  PS: 'AUI', JU: 'ASL', RO: 'ROT', A3: 'AEE', OA: 'OAL', FB: 'LZB',
  // Asian / African
  AI: 'AIC', UL: 'ALK', KQ: 'KQA', WB: 'RWD',
  // Charter / leisure
  XQ: 'SXS', HH: 'HHN',
}

function iataToCallsign(flight: string): string | null {
  // Allow trailing letters like TK8DT, U23NZ etc.
  const m = flight.match(/^([A-Z0-9]{2})(\d+[A-Z]*)$/)
  if (!m) return null
  const icao = IATA_TO_ICAO[m[1]]
  return icao ? icao + m[2] : null
}

// LLBG (Ben Gurion airport) coordinates
const LLBG_LAT = 32.0112
const LLBG_LON = 34.8866

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// airplanes.live: free ADS-B API, works from any server (Cloudflare-fronted)
async function lookupADSB(flight: string): Promise<FlightStatus | null> {
  const callsign = iataToCallsign(flight)
  if (!callsign) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://api.airplanes.live/v2/callsign/${encodeURIComponent(callsign)}`,
      { signal: controller.signal, cache: 'no-store' }
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const json = await res.json()
    const ac: Record<string, unknown>[] = json.ac ?? []
    if (!ac.length) return null

    const plane = ac[0]
    const lat       = typeof plane.lat === 'number' ? plane.lat : null
    const lon       = typeof plane.lon === 'number' ? plane.lon : null
    const gs        = typeof plane.gs  === 'number' ? plane.gs  : null  // ground speed in knots
    const altBaro   = plane.alt_baro
    const onGround  = altBaro === 'ground'

    // Calculate ETA to LLBG from current position + ground speed
    let arr_estimated: string | null = null
    if (!onGround && lat != null && lon != null && gs && gs > 50) {
      const distKm   = haversineKm(lat, lon, LLBG_LAT, LLBG_LON)
      const speedKmh = gs * 1.852  // knots → km/h
      const etaMs    = Date.now() + (distKm / speedKmh) * 3600 * 1000
      arr_estimated  = new Date(etaMs).toISOString()
    }

    return {
      flight,
      status: onGround ? 'landed' : 'en-route',
      arr_time: null,
      arr_actual: onGround ? new Date().toISOString() : null,
      arr_estimated,
      delayed: null,
    }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const flight = searchParams.get('flight')?.toUpperCase().replace(/\s/g, '')
  if (!flight) return NextResponse.json({ error: 'missing flight' }, { status: 400 })

  const cached = cache.get(flight)
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return NextResponse.json(cached.data)
  }

  const key = process.env.AIRLABS_API_KEY
  if (!key) return NextResponse.json({ error: 'no api key' }, { status: 500 })

  try {
    // Query /flight (live real-time) and /schedules in parallel
    const [liveRes, schedRes] = await Promise.all([
      fetch(`https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(flight)}&api_key=${key}`, { next: { revalidate: 0 } }),
      fetch(`https://airlabs.co/api/v9/schedules?flight_iata=${encodeURIComponent(flight)}&arr_iata=TLV&api_key=${key}`, { next: { revalidate: 0 } }),
    ])
    const [liveJson, schedJson] = await Promise.all([liveRes.json(), schedRes.json()])

    const lf = liveJson.response
    const schedFlights: Record<string, string>[] = schedJson.response ?? []
    const sf = schedFlights.sort((a, b) => {
      const ta = new Date(a.arr_time_utc ?? '').getTime()
      const tb = new Date(b.arr_time_utc ?? '').getTime()
      const now = Date.now()
      return Math.abs(ta - now) - Math.abs(tb - now)
    })[0]

    // Prefer /flight (live) — more accurate real-time status and ETA.
    // Supplement with scheduled time from /schedules if available.
    if (lf) {
      const data: FlightStatus = {
        flight,
        status: lf.status ?? 'unknown',
        arr_time: lf.arr_time ?? sf?.arr_time_utc ?? null,
        arr_actual: lf.arr_actual ?? sf?.arr_time_real ?? null,
        arr_estimated: lf.arr_estimated ?? sf?.arr_estimated_utc ?? null,
        delayed: lf.delayed ?? (sf?.delayed ? Number(sf.delayed) : null),
      }
      cache.set(flight, { data, fetchedAt: Date.now() })
      return NextResponse.json(data)
    }

    // /flight returned nothing — use /schedules (flight not yet airborne or already landed)
    if (sf) {
      const data: FlightStatus = {
        flight,
        status: sf.status ?? 'scheduled',
        arr_time: sf.arr_time_utc ?? null,
        arr_actual: sf.arr_time_real ?? null,
        arr_estimated: sf.arr_estimated_utc ?? null,
        delayed: sf.delayed ? Number(sf.delayed) : null,
      }
      cache.set(flight, { data, fetchedAt: Date.now() })
      return NextResponse.json(data)
    }

    // ADS-B fallback — covers carriers AirLabs doesn't know (e.g. Israir 6H)
    const osData = await lookupADSB(flight)
    if (osData) {
      cache.set(flight, { data: osData, fetchedAt: Date.now() })
      return NextResponse.json(osData)
    }

    return NextResponse.json({ error: 'flight not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
