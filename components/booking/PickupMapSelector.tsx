'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { useTranslations } from 'next-intl'
interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    road?: string; house_number?: string; city?: string; town?: string
    village?: string; suburb?: string; municipality?: string
    county?: string; neighbourhood?: string
    amenity?: string; tourism?: string; leisure?: string; shop?: string
    building?: string; mall?: string; historic?: string; office?: string
  }
}

function normalizeQuery(q: string): string {
  return q.replace(/[׳״]/g, '')
}

function addGershayim(q: string): string {
  return q.split(/\s+/).map(word =>
    /^[\u05D0-\u05EA]{2,6}$/.test(word) ? word.slice(0, -1) + '״' + word.slice(-1) : word
  ).join(' ')
}

function getPoiName(a: NominatimResult['address']): string {
  return a.amenity || a.tourism || a.leisure || a.shop || a.building || a.mall || a.historic || a.office || ''
}

export interface ParsedAddress {
  city: string; street: string; houseNumber: string; displayName: string
}

interface Props {
  value: string
  selected: ParsedAddress | null
  onSelect: (parsed: ParsedAddress) => void
  onClear: () => void
  houseNumber: string
  onHouseNumberChange: (v: string) => void
  priceChip?: React.ReactNode
  label?: string
  placeholder?: string
  badgeLabel?: string
  pinColor?: string
}

export default function PickupMapSelector({
  value, selected, onSelect, onClear,
  houseNumber, onHouseNumberChange,
  priceChip,
  label,
  placeholder,
  badgeLabel,
  pinColor = '#FFD100',
}: Props) {
  const tMap = useTranslations('mapSelector')
  const resolvedLabel = label ?? tMap('pickupLabel') + ' *'
  const resolvedPlaceholder = placeholder ?? tMap('pickupPlaceholder')
  const resolvedBadgeLabel = badgeLabel ?? tMap('pickupLabel')
  const [phase, setPhase] = useState<'idle' | 'searching' | 'selected'>(selected ? 'selected' : 'idle')
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-40, 40], [4, -4])
  const rotateY = useTransform(mouseX, [-40, 40], [-4, 4])
  const springRX = useSpring(rotateX, { stiffness: 280, damping: 28 })
  const springRY = useSpring(rotateY, { stiffness: 280, damping: 28 })

  useEffect(() => {
    if (!value && !selected) { setPhase('idle'); setQuery('') }
  }, [value, selected])

  function onMouseMove(e: React.MouseEvent) {
    if (!containerRef.current || phase === 'searching') return
    const r = containerRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (r.left + r.width / 2))
    mouseY.set(e.clientY - (r.top + r.height / 2))
  }
  function onMouseLeaveCard() {
    mouseX.set(0); mouseY.set(0); setHovered(false)
  }

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const data: NominatimResult[] = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  function handleChange(val: string) {
    setQuery(val)
    onClear()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 380)
  }

  function handleSelect(r: NominatimResult) {
    const a = r.address
    const city = a.city || a.town || a.village || a.municipality || a.suburb || a.neighbourhood || a.county || ''
    const poiName = getPoiName(a)
    const street = poiName || a.road || ''
    const num = poiName ? '' : (a.house_number || query.match(/\b(\d+)\b/)?.[1] || '')
    const display = poiName
      ? [poiName, city].filter(Boolean).join(', ')
      : [street, num, city].filter(Boolean).join(' ')
    setQuery(display)
    setResults([])
    setPhase('selected')
    onSelect({ city, street, houseNumber: num, displayName: display })
  }

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

  function openSearch() {
    setPhase('searching')
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 80)
  }

  function closeSearch() {
    setPhase(selected ? 'selected' : 'idle')
    setResults([])
  }

  // Close on outside click/touch
  useEffect(() => {
    if (phase !== 'searching') return
    function handler(e: MouseEvent | TouchEvent) {
      const t = e.target as Node
      if (!containerRef.current?.contains(t)) closeSearch()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected])

  const isClickable = phase === 'idle' || phase === 'selected'
  const fullAddress = selected
    ? [selected.street, selected.houseNumber || houseNumber, selected.city].filter(Boolean).join(' ')
    : ''

  const dropdown = results.length > 0 && phase === 'searching'
    ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            marginTop: 4, background: '#1a1a1a',
            border: '1px solid rgba(255,209,0,0.2)',
            borderRadius: 12, zIndex: 9999,
            boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
            maxHeight: 260, overflowY: 'auto',
          }}>
          {results.map((r, i) => {
            const a = r.address
            const city = a.city || a.town || a.village || a.municipality || ''
            const poiName = getPoiName(a)
            const street = a.road || ''
            const house = a.house_number || ''
            const line1 = poiName || [street, house].filter(Boolean).join(' ') || city
            const line2 = poiName ? [street, city].filter(Boolean).join(', ') : (line1 !== city ? city : '')
            return (
              <motion.div key={r.place_id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
                onTouchStart={e => { e.preventDefault(); handleSelect(r) }}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                whileHover={{ background: 'rgba(255,209,0,0.07)' }}
              >
                <span style={{ fontSize: 14, color: pinColor, flexShrink: 0 }}>📍</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F2F2F2' }}>{line1}</div>
                  {line2 && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{line2}</div>}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )
    : null

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 8 }}>{resolvedLabel}</label>

      <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ perspective: '1000px' }}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={onMouseLeaveCard}
      >
        {/* ─── THE CARD ─────────────────────────────────────── */}
        <motion.div
          style={{
            rotateX: springRX, rotateY: springRY,
            transformStyle: 'preserve-3d',
            position: 'relative', overflow: 'hidden',
            borderRadius: 14, height: 120, background: '#0d0d0d',
            cursor: isClickable ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          animate={{
            borderColor: phase === 'searching'
              ? 'rgba(255,209,0,0.55)'
              : phase === 'selected'
              ? hovered ? 'rgba(255,209,0,0.4)' : 'rgba(255,209,0,0.22)'
              : hovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)',
            boxShadow: phase === 'searching'
              ? '0 0 0 3px rgba(255,209,0,0.1), 0 12px 40px rgba(0,0,0,0.6)'
              : phase === 'selected' && hovered
              ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,209,0,0.15)'
              : '0 4px 20px rgba(0,0,0,0.4)',
          }}
          transition={{ duration: 0.25 }}
          onClick={() => { if (isClickable) openSearch() }}
          whileTap={isClickable ? { scale: 0.985 } : {}}
        >
          {/* Map roads (always visible) */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
            {[['0%','36%','100%','36%',3], ['0%','67%','100%','67%',3]].map(([x1,y1,x2,y2,w],i) => (
              <motion.line key={`h${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.09)" strokeWidth={w}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.1 + i*0.12 }} />
            ))}
            {[['27%','0%','27%','100%',2], ['64%','0%','64%','100%',2]].map(([x1,y1,x2,y2,w],i) => (
              <motion.line key={`v${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.06)" strokeWidth={w}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.25 + i*0.1 }} />
            ))}
            {[18,52,83].map((y,i) => (
              <motion.line key={`hs${i}`} x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
                stroke="rgba(255,255,255,0.03)" strokeWidth="1.5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + i*0.07 }} />
            ))}
            {[11,43,79].map((x,i) => (
              <motion.line key={`vs${i}`} x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%"
                stroke="rgba(255,255,255,0.03)" strokeWidth="1.5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.5 + i*0.07 }} />
            ))}
          </svg>

          {/* Buildings */}
          {[
            [42,8,12,23,0.3], [12,33,10,18,0.4], [70,70,14,20,0.5],
            [14,82,9,24,0.35], [54,3,7,10,0.45], [7,71,11,9,0.55],
          ].map(([top,left,w,h,d],i) => (
            <motion.div key={i} style={{
              position: 'absolute', top: `${top}%`, left: `${left}%`,
              width: `${w}%`, height: `${h}%`,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(255,255,255,0.03)',
            }}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: d }} />
          ))}

          {/* Gradient overlays */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,13,13,0.93) 0%, transparent 52%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(13,13,13,0.75) 0%, transparent 58%)', pointerEvents: 'none' }} />

          {/* Pin (idle + selected) */}
          <AnimatePresence>
            {phase !== 'searching' && (
              <motion.div key="pin"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', zIndex: 10, pointerEvents: 'none' }}
                initial={{ scale: 0, y: -16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0, y: -10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              >
                <motion.div
                  animate={phase === 'idle' ? { y: [0, -7, 0] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="26" height="32" viewBox="0 0 24 30" fill="none"
                    style={{ filter: `drop-shadow(0 2px 8px ${pinColor}88)` }}>
                    <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z"
                      fill={phase === 'selected' ? pinColor : `${pinColor}66`} />
                    <circle cx="12" cy="9" r="3.5" fill="#0d0d0d" />
                  </svg>
                </motion.div>
                {/* Shadow pulse */}
                <motion.div style={{
                  position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
                  width: 16, height: 5, borderRadius: '50%',
                  background: `${pinColor}44`,
                }}
                  animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── IDLE content ── */}
          <AnimatePresence>
            {phase === 'idle' && (
              <motion.div key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, zIndex: 10 }}
              >
                <motion.div
                  animate={{ scale: hovered ? 1.05 : [1, 1.03, 1] }}
                  transition={hovered ? { duration: 0.15 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    background: `${pinColor}18`,
                    border: `1px solid ${pinColor}44`,
                    borderRadius: 24, padding: '7px 20px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <span style={{ fontSize: 15 }}>📍</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: pinColor }}>{tMap('clickToSelect')}</span>
                </motion.div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2px' }}>
                  {resolvedBadgeLabel}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SEARCHING content ── */}
          <AnimatePresence>
            {phase === 'searching' && (
              <motion.div key="search"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', inset: 0, zIndex: 20,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  padding: '0 48px 0 14px', gap: 8,
                  background: 'rgba(13,13,13,0.94)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: pinColor, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {resolvedLabel}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={resolvedPlaceholder}
                    value={query}
                    onChange={e => handleChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEnter() } }}
                    autoComplete="off"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)',
                      border: `1px solid ${pinColor}55`,
                      borderRadius: 10, color: '#F2F2F2',
                      padding: '10px 14px', fontSize: 15, outline: 'none',
                      direction: 'rtl',
                    }}
                  />
                  {loading && (
                    <motion.div
                      animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#666' }}>
                      {tMap('searching')}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Close button (searching) */}
          <AnimatePresence>
            {phase === 'searching' && (
              <motion.button key="close"
                type="button"
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                onClick={e => { e.stopPropagation(); closeSearch() }}
                style={{
                  position: 'absolute', top: 10, left: 10, zIndex: 30,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, color: 'rgba(255,255,255,0.45)',
                  fontSize: 16, cursor: 'pointer', padding: '3px 8px', lineHeight: 1,
                }}
                whileTap={{ scale: 0.9 }}
              >✕</motion.button>
            )}
          </AnimatePresence>

          {/* ── SELECTED content ── */}
          <AnimatePresence>
            {phase === 'selected' && (
              <>
                {/* Badge top-right */}
                <motion.div key="badge"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{
                    position: 'absolute', top: 10, right: 12, zIndex: 10,
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: `${pinColor}18`, border: `1px solid ${pinColor}33`,
                    borderRadius: 20, padding: '3px 10px',
                  }}
                >
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                    style={{ width: 5, height: 5, borderRadius: '50%', background: pinColor }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: pinColor, letterSpacing: '0.4px' }}>{resolvedBadgeLabel}</span>
                </motion.div>

                {/* Edit hint top-left */}
                <motion.div key="edit-hint"
                  initial={{ opacity: 0 }} animate={{ opacity: hovered ? 1 : 0 }} exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', top: 10, left: 12, zIndex: 10,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '3px 10px',
                    fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    pointerEvents: 'none',
                  }}>
                  ✏️ <span>{tMap('clickToChange')}</span>
                </motion.div>

                {/* Address bottom-right */}
                <motion.div key="addr"
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 24 }}
                  style={{ position: 'absolute', bottom: 12, right: 14, zIndex: 10, textAlign: 'right', direction: 'rtl' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#F0F0F0', lineHeight: 1.35, marginBottom: 4 }}>
                    {fullAddress}
                  </div>
                  {priceChip}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Hover shimmer overlay */}
          <motion.div
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at 50% 50%, ${pinColor}08 0%, transparent 70%)` }}
            animate={{ opacity: hovered && isClickable ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          />
        </motion.div>
      </div>
      {dropdown}
      </div>

      {/* House number */}
      <AnimatePresence>
        {phase === 'selected' && selected?.street && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden', marginTop: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 12 }}>{tMap('houseNumber')}</label>
              <input type="text" placeholder="7" value={houseNumber}
                onChange={e => onHouseNumberChange(e.target.value)}
                style={{ width: 80, padding: '6px 10px', fontSize: 14 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
