import { NextResponse } from 'next/server'

interface FlightStatus {
  flight: string
  status: string          // scheduled | en-route | landed | cancelled | diverted | unknown
  arr_time: string | null // scheduled arrival (UTC)
  arr_actual: string | null  // actual arrival (UTC)
  arr_estimated: string | null // estimated arrival (UTC)
  delayed: number | null  // minutes delayed
}

// In-memory cache per flight number — 15 min TTL
const cache = new Map<string, { data: FlightStatus; fetchedAt: number }>()
const CACHE_MS = 15 * 60 * 1000

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
    // Try /schedules first (works for future & recent flights arriving at TLV)
    const schedRes = await fetch(
      `https://airlabs.co/api/v9/schedules?flight_iata=${encodeURIComponent(flight)}&arr_iata=TLV&api_key=${key}`,
      { next: { revalidate: 0 } }
    )
    const schedJson = await schedRes.json()
    const schedFlights: Record<string, string>[] = schedJson.response ?? []
    // Pick the closest upcoming (or most recent) flight
    const f = schedFlights.sort((a, b) => {
      const ta = new Date(a.arr_time_utc ?? a.dep_time_utc ?? '').getTime()
      const tb = new Date(b.arr_time_utc ?? b.dep_time_utc ?? '').getTime()
      const now = Date.now()
      return Math.abs(ta - now) - Math.abs(tb - now)
    })[0]

    if (f) {
      const data: FlightStatus = {
        flight,
        status: f.status ?? 'scheduled',
        arr_time: f.arr_time_utc ?? null,
        arr_actual: f.arr_time_real ?? null,
        arr_estimated: f.arr_estimated_utc ?? null,
        delayed: f.delayed ? Number(f.delayed) : null,
      }
      cache.set(flight, { data, fetchedAt: Date.now() })
      return NextResponse.json(data)
    }

    // Fallback: /flight for currently airborne flights
    const liveRes = await fetch(
      `https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(flight)}&api_key=${key}`,
      { next: { revalidate: 0 } }
    )
    const liveJson = await liveRes.json()
    const lf = liveJson.response

    if (!lf) return NextResponse.json({ error: 'flight not found' }, { status: 404 })

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
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
