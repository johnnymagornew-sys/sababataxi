'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    suburb?: string
    municipality?: string
    county?: string
    neighbourhood?: string
    amenity?: string
    tourism?: string
    leisure?: string
    shop?: string
    building?: string
    mall?: string
    historic?: string
    office?: string
  }
}

// Strip Hebrew geresh (׳) and gershayim (״) so "תרמב" matches "תרמ״ב"
function normalizeQuery(q: string): string {
  return q.replace(/[׳״]/g, '')
}

// Insert ״ before last letter of short Hebrew words so "תשח" matches "תש״ח"
function addGershayim(q: string): string {
  return q.split(/\s+/).map(word =>
    /^[\u05D0-\u05EA]{2,6}$/.test(word) ? word.slice(0, -1) + '״' + word.slice(-1) : word
  ).join(' ')
}

function getPoiName(a: NominatimResult['address']): string {
  return a.amenity || a.tourism || a.leisure || a.shop || a.building || a.mall || a.historic || a.office || ''
}

export interface ParsedAddress {
  city: string
  street: string
  houseNumber: string
  displayName: string
}

interface Props {
  value: string
  onSelect: (parsed: ParsedAddress) => void
  onClear: () => void
}

export default function AddressAutocomplete({ value, onSelect, onClear }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef(false)

  // Close on outside click/touch
  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  // Sync external value (form reset)
  useEffect(() => { setQuery(value) }, [value])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const data: NominatimResult[] = await res.json()
      const arr = Array.isArray(data) ? data : []
      setResults(arr)
      if (arr.length > 0) setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleEnter = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (results.length > 0) { handleSelect(results[0]); return }
    if (query.length < 2) return
    setLoading(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
      const data: NominatimResult[] = await res.json()
      const arr = Array.isArray(data) ? data : []
      if (arr.length > 0) handleSelect(arr[0])
    } catch {} finally { setLoading(false) }
  }, [query, results]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(val: string) {
    setQuery(val)
    selectedRef.current = false
    onClear()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 400)
  }

  function handleSelect(r: NominatimResult) {
    const addr = r.address
    const city = addr.city || addr.town || addr.village || addr.municipality ||
      addr.suburb || addr.neighbourhood || addr.county || ''
    const poiName = getPoiName(addr)
    const street = poiName || addr.road || ''
    const numberFromQuery = query.match(/\b(\d+)\b/)?.[1] || ''
    const houseNumber = poiName ? '' : (addr.house_number || numberFromQuery)
    const display = poiName
      ? [poiName, city].filter(Boolean).join(', ')
      : [street, houseNumber, city].filter(Boolean).join(' ')
    setQuery(display)
    setOpen(false)
    selectedRef.current = true
    onSelect({ city, street, houseNumber, displayName: display })
  }

  const dropdown = open && results.length > 0 ? (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: 'var(--card2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        zIndex: 9999,
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        maxHeight: 280,
        overflowY: 'auto',
        marginTop: 4,
      }}
    >
      {results.map(r => {
        const addr = r.address
        const city = addr.city || addr.town || addr.village || addr.municipality || ''
        const poiName = getPoiName(addr)
        const street = addr.road || ''
        const house = addr.house_number || ''
        const line1 = poiName || [street, house].filter(Boolean).join(' ') || city
        const line2 = poiName ? [street, city].filter(Boolean).join(', ') : (line1 !== city ? city : '')
        return (
          <div
            key={r.place_id}
            onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
            onTouchStart={e => { e.preventDefault(); handleSelect(r) }}
            style={{
              padding: '12px 16px', cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)' }}>{line1}</div>
            {line2 && <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 3 }}>{line2}</div>}
          </div>
        )
      })}
    </div>
  ) : null

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="הקלד כתובת: רחוב ומספר, עיר..."
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => {
          if (results.length > 0 && !selectedRef.current) setOpen(true)
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEnter() } }}
        autoComplete="off"
      />
      {loading && (
        <div style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, color: 'var(--txt2)', pointerEvents: 'none',
        }}>
          מחפש...
        </div>
      )}
      {dropdown}
    </div>
  )
}
