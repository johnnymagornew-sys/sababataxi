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
  }
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
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef(false)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync external value (e.g. on form reset)
  useEffect(() => {
    setQuery(value)
  }, [value])

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=il&limit=6&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
      if (data.length > 0) setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(val: string) {
    setQuery(val)
    selectedRef.current = false
    onClear()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 400)
  }

  function handleSelect(r: NominatimResult) {
    const addr = r.address
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.county ||
      ''
    const street = addr.road || ''
    // If Nominatim didn't return a house number, extract it from what the user typed
    const numberFromQuery = query.match(/\b(\d+)\b/)?.[1] || ''
    const houseNumber = addr.house_number || numberFromQuery
    const display = [street, houseNumber, city].filter(Boolean).join(' ')

    setQuery(display)
    setOpen(false)
    selectedRef.current = true
    onSelect({ city, street, houseNumber, displayName: display })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="הקלד כתובת מלאה: רחוב ומספר, עיר..."
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => {
          if (results.length > 0 && !selectedRef.current) setOpen(true)
        }}
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
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, left: 0,
          background: 'var(--card2)', border: '1px solid var(--border)',
          borderRadius: 8, zIndex: 20, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: 4,
          maxHeight: 300, overflowY: 'auto',
        }}>
          {results.map(r => {
            const addr = r.address
            const city = addr.city || addr.town || addr.village || addr.municipality || ''
            const street = addr.road || ''
            const house = addr.house_number || ''
            const line1 = [street, house].filter(Boolean).join(' ') || city
            const line2 = line1 !== city ? city : ''
            return (
              <div
                key={r.place_id}
                onMouseDown={() => handleSelect(r)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>{line1}</div>
                {line2 && (
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>{line2}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
