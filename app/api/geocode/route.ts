import { NextResponse } from 'next/server'

const CACHE = new Map<string, { data: unknown[]; at: number }>()
const TTL = 5 * 60 * 1000 // 5 min cache

interface HereItem {
  id: string
  title: string
  resultType: string
  address: {
    label?: string
    city?: string
    district?: string
    county?: string
    street?: string
    houseNumber?: string
  }
}

function hashId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function parseItem(item: HereItem) {
  const addr = item.address
  const city = addr.city || addr.district || addr.county || ''
  const isPoi = item.resultType === 'place' || item.resultType === 'chainQuery'
  return {
    place_id: hashId(item.id),
    display_name: item.title,
    address: {
      road: addr.street || '',
      house_number: addr.houseNumber || '',
      city,
      ...(isPoi ? { amenity: item.title } : {}),
    }
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const cacheKey = q.toLowerCase()
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.at < TTL) return NextResponse.json(cached.data)

  const key = process.env.HERE_MAPS_API_KEY
  if (!key) return NextResponse.json({ error: 'no key' }, { status: 500 })

  try {
    const res = await fetch(
      `https://autosuggest.search.hereapi.com/v1/autosuggest?q=${encodeURIComponent(q)}&in=countryCode:ISR&lang=he&limit=6&apiKey=${key}`,
      { cache: 'no-store' }
    )
    const json = await res.json()
    const items: HereItem[] = json.items ?? []
    const results = items.map(parseItem).slice(0, 6)
    CACHE.set(cacheKey, { data: results, at: Date.now() })
    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
