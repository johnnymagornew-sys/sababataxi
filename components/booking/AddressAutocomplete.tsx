'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

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
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef(false)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync external value (form reset)
  useEffect(() => { setQuery(value) }, [value])

  // Recalculate dropdown position when opened
  useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownRect({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [open])

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
    const city = addr.city || addr.town || addr.village || addr.municipality ||
      addr.suburb || addr.neighbourhood || addr.county || ''
    const street = addr.road || ''
    const numberFromQuery = query.match(/\b(\d+)\b/)?.[1] || ''
    const houseNumber = addr.house_number || numberFromQuery
    const display = [street, houseNumber, city].filter(Boolean).join(' ')
    setQuery(display)
    setOpen(false)
    selectedRef.current = true
    onSelect({ city, street, houseNumber, displayName: display })
  }

  const dropdown = open && results.length > 0 && dropdownRect ? createPortal(
    <div
      style={{
        position: 'absolute',
        top: dropdownRect.top,
        left: dropdownRect.left,
        width: dropdownRect.width,
        background: 'var(--card2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        zIndex: 9999,
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
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
            onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
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
    </div>,
    document.body
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
