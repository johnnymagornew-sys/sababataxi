import { NextResponse } from 'next/server'

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

// IATA airline code → ICAO 3-letter code (for OpenSky callsign lookup)
const IATA_TO_ICAO: Record<string, string> = {
  LY: 'ELY', '6H': 'ISR', IZ: 'AIZ',
  FR: 'RYR', U2: 'EZY', W6: 'WZZ',
  TK: 'THY', LH: 'DLH', BA: 'BAW',
  AF: 'AFR', KL: 'KLM', OS: 'AUA',
  EK: 'UAE', QR: 'QTR', ET: 'ETH',
  AY: 'FIN', SK: 'SAS', IB: 'IBE',
  VY: 'VLG', PS: 'AUI', RO: 'ROT',
}

function iataToCallsign(flight: string): string | null {
  const m = flight.match(/^([A-Z0-9]{2})(\d+[A-Z]?)$/)
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

// OpenSky: wider bounding box covers Mediterranean approach corridor to Israel
async function lookupOpenSky(flight: string): Promise<FlightStatus | null> {
  const callsign = iataToCallsign(flight)
  if (!callsign) return null

  try {
    const res = await fetch(
      'https://opensky-network.org/api/states/all?lamin=28&lomin=25&lamax=36&lomax=42',
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const states: unknown[][] = json.states ?? []

    // Find by callsign (OpenSky pads to 8 chars with spaces)
    const match = states.find(s => typeof s[1] === 'string' && s[1].trim() === callsign)
    if (!match) return null

    const lon      = match[5] as number | null
    const lat      = match[6] as number | null
    const onGround = match[8] === true
    const velocity = match[9] as number | null  // m/s

    // Calculate ETA to LLBG from current position + speed
    let arr_estimated: string | null = null
    if (!onGround && lat != null && lon != null && velocity && velocity > 10) {
      const distKm = haversineKm(lat, lon, LLBG_LAT, LLBG_LON)
      const etaMs = Date.now() + (distKm / (velocity * 3.6)) * 3600 * 1000
      arr_estimated = new Date(etaMs).toISOString()
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
    // 1. AirLabs /schedules — works for upcoming & recent flights
    const schedRes = await fetch(
      `https://airlabs.co/api/v9/schedules?flight_iata=${encodeURIComponent(flight)}&arr_iata=TLV&api_key=${key}`,
      { next: { revalidate: 0 } }
    )
    const schedJson = await schedRes.json()
    const schedFlights: Record<string, string>[] = schedJson.response ?? []
    const sf = schedFlights.sort((a, b) => {
      const ta = new Date(a.arr_time_utc ?? '').getTime()
      const tb = new Date(b.arr_time_utc ?? '').getTime()
      const now = Date.now()
      return Math.abs(ta - now) - Math.abs(tb - now)
    })[0]

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

    // 2. AirLabs /flight — for currently airborne flights
    const liveRes = await fetch(
      `https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(flight)}&api_key=${key}`,
      { next: { revalidate: 0 } }
    )
    const liveJson = await liveRes.json()
    const lf = liveJson.response

    if (lf) {
      const data: FlightStatus = {
        flight,
        status: lf.status ?? 'unknown',
        arr_time: lf.arr_time ?? null,
        arr_actual: lf.arr_actual ?? null,
        arr_estimated: lf.arr_estimated ?? null,
        delayed: lf.delayed ?? null,
      }
      cache.set(flight, { data, fetchedAt: Date.now() })
      return NextResponse.json(data)
    }

    // 3. OpenSky fallback — covers carriers AirLabs doesn't know (e.g. Israir 6H)
    const osData = await lookupOpenSky(flight)
    if (osData) {
      cache.set(flight, { data: osData, fetchedAt: Date.now() })
      return NextResponse.json(osData)
    }

    return NextResponse.json({ error: 'flight not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
