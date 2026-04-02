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
    const res = await fetch(
      `https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(flight)}&api_key=${key}`,
      { next: { revalidate: 0 } }
    )
    const json = await res.json()
    const f = json.response

    if (!f) return NextResponse.json({ error: 'flight not found' }, { status: 404 })

    const data: FlightStatus = {
      flight,
      status: f.status ?? 'unknown',
      arr_time: f.arr_time ?? null,
      arr_actual: f.arr_actual ?? null,
      arr_estimated: f.arr_estimated ?? null,
      delayed: f.delayed ?? null,
    }

    cache.set(flight, { data, fetchedAt: Date.now() })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
