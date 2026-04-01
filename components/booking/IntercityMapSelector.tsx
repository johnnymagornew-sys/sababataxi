'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { createPortal } from 'react-dom'

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    road?: string; house_number?: string; city?: string; town?: string
    village?: string; suburb?: string; municipality?: string
    county?: string; neighbourhood?: string
  }
}

export interface ParsedAddress {
  city: string; street: string; houseNumber: string; displayName: string
}

interface Props {
  pickup: ParsedAddress | null
  destination: ParsedAddress | null
  pickupHouseNumber: string
  destinationHouseNumber: string
  onPickupSelect: (p: ParsedAddress) => void
  onDestinationSelect: (p: ParsedAddress) => void
  onPickupClear: () => void
  onDestinationClear: () => void
  onPickupHouseNumberChange: (v: string) => void
  onDestinationHouseNumberChange: (v: string) => void
  priceChip?: React.ReactNode
}

type Phase = 'idle' | 'pickup' | 'destination' | 'complete'

export default function IntercityMapSelector({
  pickup, destination,
  pickupHouseNumber, destinationHouseNumber,
  onPickupSelect, onDestinationSelect,
  onPickupClear, onDestinationClear,
  onPickupHouseNumberChange, onDestinationHouseNumberChange,
  priceChip,
}: Props) {
  const initPhase = (): Phase => {
    if (pickup && destination) return 'complete'
    if (pickup) return 'destination'
    return 'idle'
  }
  const [phase, setPhase] = useState<Phase>(initPhase)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-40, 40], [3, -3])
  const rotateY = useTransform(mouseX, [-40, 40], [-3, 3])
  const springRX = useSpring(rotateX, { stiffness: 260, damping: 28 })
  const springRY = useSpring(rotateY, { stiffness: 260, damping: 28 })

  // Sync external resets
  useEffect(() => {
    if (!pickup && !destination) setPhase('idle')
    else if (pickup && !destination) setPhase('destination')
    else if (pickup && destination) setPhase('complete')
  }, [pickup, destination])

  function onMouseMove(e: React.MouseEvent) {
    if (!containerRef.current || phase === 'pickup' || phase === 'destination') return
    const r = containerRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (r.left + r.width / 2))
    mouseY.set(e.clientY - (r.top + r.height / 2))
  }

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return }
    setLoading(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=il&limit=6&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
      )
      setResults(await r.json())
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  function updateDropRect() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropRect({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
    }
  }

  function handleChange(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 380)
    updateDropRect()
  }

  function handleSelect(r: NominatimResult) {
    const a = r.address
    const city = a.city || a.town || a.village || a.municipality || a.suburb || a.neighbourhood || a.county || ''
    const street = a.road || ''
    const num = a.house_number || query.match(/\b(\d+)\b/)?.[1] || ''
    const display = [street, num, city].filter(Boolean).join(' ')
    setResults([])
    setQuery('')

    if (phase === 'pickup') {
      onPickupSelect({ city, street, houseNumber: num, displayName: display })
      setTimeout(() => {
        setPhase('destination')
        setTimeout(() => { inputRef.current?.focus() }, 80)
      }, 120)
    } else if (phase === 'destination') {
      onDestinationSelect({ city, street, houseNumber: num, displayName: display })
      setPhase('complete')
    }
  }

  function openEdit(target: 'pickup' | 'destination') {
    if (target === 'pickup') {
      onPickupClear()
      onDestinationClear()
      setQuery('')
      setPhase('pickup')
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      onDestinationClear()
      setQuery('')
      setPhase('destination')
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }

  function handleCardClick() {
    if (phase === 'idle') {
      setPhase('pickup')
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }

  // Close on outside click — skip if click is inside the portal dropdown
  useEffect(() => {
    if (phase !== 'pickup' && phase !== 'destination') return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      const insideCard = containerRef.current?.contains(t)
      const insideDropdown = dropdownRef.current?.contains(t)
      if (!insideCard && !insideDropdown) {
        if (pickup && destination) setPhase('complete')
        else if (pickup) setPhase('destination')
        else setPhase('idle')
        setResults([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pickup, destination])

  const isExpanded = phase === 'pickup' || phase === 'destination'
  const isIdle = phase === 'idle'
  const isComplete = phase === 'complete'
  const cardHeight = isExpanded ? (phase === 'destination' && pickup ? 200 : 160) : 120

  const pickupDisplay = pickup
    ? [pickup.street, pickupHouseNumber || pickup.houseNumber, pickup.city].filter(Boolean).join(' ')
    : ''
  const destDisplay = destination
    ? [destination.street, destinationHouseNumber || destination.houseNumber, destination.city].filter(Boolean).join(' ')
    : ''

  const dropdown = results.length > 0 && dropRect && isExpanded
    ? createPortal(
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute', top: dropRect.top, left: dropRect.left,
            width: dropRect.width, background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, zIndex: 9999,
            boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
            maxHeight: 240, overflowY: 'auto',
          }}>
          {results.map((r, i) => {
            const a = r.address
            const city = a.city || a.town || a.village || a.municipality || ''
            const street = a.road || ''
            const house = a.house_number || ''
            const line1 = [street, house].filter(Boolean).join(' ') || city
            const line2 = line1 !== city ? city : ''
            return (
              <motion.div key={r.place_id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
                style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', gap: 10, alignItems: 'center' }}
                whileHover={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <span style={{ fontSize: 13, flexShrink: 0, color: phase === 'pickup' ? '#FFD100' : '#3B82F6' }}>
                  {phase === 'pickup' ? '📍' : '🎯'}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F2F2F2' }}>{line1}</div>
                  {line2 && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{line2}</div>}
                </div>
              </motion.div>
            )
          })}
        </motion.div>,
        document.body
      )
    : null

  return (
    <div>
      <div ref={containerRef} style={{ perspective: '1000px' }}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { mouseX.set(0); mouseY.set(0); setHovered(false) }}
      >
        <motion.div
          style={{
            rotateX: springRX, rotateY: springRY,
            transformStyle: 'preserve-3d',
            position: 'relative', overflow: 'hidden',
            borderRadius: 14, background: '#0d0d0d',
            cursor: isIdle ? 'pointer' : 'default',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
          animate={{
            height: cardHeight,
            borderColor: isExpanded
              ? 'rgba(255,255,255,0.2)'
              : isComplete && hovered
              ? 'rgba(255,255,255,0.15)'
              : isComplete
              ? 'rgba(255,255,255,0.1)'
              : hovered
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(255,255,255,0.09)',
            boxShadow: isExpanded
              ? '0 0 0 3px rgba(255,255,255,0.04), 0 16px 48px rgba(0,0,0,0.7)'
              : '0 4px 20px rgba(0,0,0,0.5)',
          }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          onClick={handleCardClick}
          whileTap={isIdle ? { scale: 0.985 } : {}}
        >
          {/* Map roads background */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: isExpanded ? 0.4 : 1 }} preserveAspectRatio="none">
            {[['0%','36%','100%','36%'], ['0%','67%','100%','67%']].map(([x1,y1,x2,y2],i) => (
              <motion.line key={`h${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.09)" strokeWidth="3"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.1 + i*0.12 }} />
            ))}
            {[['27%','0%','27%','100%'], ['64%','0%','64%','100%']].map(([x1,y1,x2,y2],i) => (
              <motion.line key={`v${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.06)" strokeWidth="2"
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
          {[[42,8,12,22], [12,33,10,17], [70,70,13,19], [14,82,8,23], [54,3,6,10]].map(([top,left,w,h],i) => (
            <motion.div key={i} style={{
              position: 'absolute', top: `${top}%`, left: `${left}%`,
              width: `${w}%`, height: `${h}%`, borderRadius: 3,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.025)',
            }}
              initial={{ opacity: 0 }} animate={{ opacity: isExpanded ? 0.4 : 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }} />
          ))}

          {/* Gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,13,13,0.92) 0%, transparent 55%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(13,13,13,0.7) 0%, transparent 60%)', pointerEvents: 'none' }} />

          {/* ── IDLE ── */}
          <AnimatePresence>
            {isIdle && (
              <motion.div key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10 }}
              >
                <motion.div
                  animate={{ scale: hovered ? 1.05 : [1, 1.03, 1] }}
                  transition={hovered ? { duration: 0.15 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 24, padding: '8px 22px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <span style={{ fontSize: 14, color: '#FFD100' }}>📍</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>→</span>
                  <span style={{ fontSize: 14, color: '#3B82F6' }}>🎯</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0', marginRight: 4 }}>בחר מסלול בין עירוני</span>
                </motion.div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>לחץ לבחירת כתובות איסוף ויעד</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── EXPANDED (pickup / destination) ── */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div key="expanded"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', inset: 0, zIndex: 20,
                  background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(8px)',
                  display: 'flex', flexDirection: 'column', padding: 14, gap: 10,
                }}
              >
                {/* Pickup row — confirmed or input */}
                {phase === 'destination' && pickup ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => openEdit('pickup')}
                    whileHover={{ background: 'rgba(255,209,0,0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'rgba(255,209,0,0.07)', border: '1px solid rgba(255,209,0,0.2)',
                      borderRadius: 10, padding: '8px 12px', cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13, flexShrink: 0 }}>📍</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: '#FFD100', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 1 }}>איסוף — לחץ לשינוי</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E8E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pickupDisplay}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>✏️</span>
                  </motion.div>
                ) : phase === 'pickup' ? (
                  <SearchField
                    ref={inputRef}
                    label="כתובת איסוף"
                    labelColor="#FFD100"
                    placeholder="הקלד כתובת: רחוב ומספר, עיר..."
                    query={query}
                    loading={loading}
                    onChange={handleChange}
                    onFocus={updateDropRect}
                  />
                ) : null}

                {/* Divider with arrow */}
                {phase === 'destination' && (
                  <motion.div
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>↓</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                  </motion.div>
                )}

                {/* Destination input */}
                {phase === 'destination' && (
                  <SearchField
                    ref={inputRef}
                    label="כתובת יעד"
                    labelColor="#3B82F6"
                    placeholder="הקלד כתובת יעד..."
                    query={query}
                    loading={loading}
                    onChange={handleChange}
                    onFocus={updateDropRect}
                  />
                )}

                {/* Close */}
                <motion.button type="button"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => {
                    if (pickup && destination) setPhase('complete')
                    else if (pickup) setPhase('destination')
                    else setPhase('idle')
                    setResults([])
                  }}
                  style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: 'rgba(255,255,255,0.35)', fontSize: 15,
                    cursor: 'pointer', padding: '2px 8px', lineHeight: 1,
                  }}
                  whileTap={{ scale: 0.9 }}
                >✕</motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── COMPLETE ── */}
          <AnimatePresence>
            {isComplete && (
              <motion.div key="complete"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ position: 'absolute', inset: 0, zIndex: 10 }}
              >
                {/* Top row — pickup (full row clickable) */}
                <motion.div
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                  onClick={e => { e.stopPropagation(); openEdit('pickup') }}
                  whileHover={{ background: 'rgba(255,209,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                    display: 'flex', alignItems: 'center', padding: '0 12px 0 40px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, direction: 'rtl', textAlign: 'right', minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#FFD100', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>📍 איסוף</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#EFEFEF', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickupDisplay}</div>
                  </div>
                  <motion.div animate={{ opacity: hovered ? 0.5 : 0.2 }} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0, paddingRight: 4 }}>✏️</motion.div>
                </motion.div>

                {/* Bottom row — destination (full row clickable) */}
                <motion.div
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 24 }}
                  onClick={e => { e.stopPropagation(); openEdit('destination') }}
                  whileHover={{ background: 'rgba(59,130,246,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                    display: 'flex', alignItems: 'center', padding: '0 12px 0 40px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, direction: 'rtl', textAlign: 'right', minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#3B82F6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>🎯 יעד</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#EFEFEF', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destDisplay}</div>
                  </div>
                  <motion.div animate={{ opacity: hovered ? 0.5 : 0.2 }} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0, paddingRight: 4 }}>✏️</motion.div>
                </motion.div>

                {/* Swap button — center divider */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
                  onClick={e => {
                    e.stopPropagation()
                    if (!pickup || !destination) return
                    const p = pickup, d = destination
                    const ph = pickupHouseNumber, dh = destinationHouseNumber
                    onPickupClear(); onDestinationClear()
                    setTimeout(() => {
                      onPickupSelect({ ...d, houseNumber: dh || d.houseNumber })
                      onDestinationSelect({ ...p, houseNumber: ph || p.houseNumber })
                    }, 10)
                  }}
                  whileHover={{ scale: 1.15, background: 'rgba(255,255,255,0.14)' }}
                  whileTap={{ scale: 0.88, rotate: 180 }}
                  style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    zIndex: 20, width: 28, height: 28,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: 'rgba(255,255,255,0.6)',
                    padding: 0,
                  }}
                >⇅</motion.button>

                {/* Price chip */}
                {priceChip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ position: 'absolute', top: 7, left: 44, zIndex: 5, pointerEvents: 'none' }}
                  >
                    {priceChip}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hover shimmer */}
          <motion.div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)' }}
            animate={{ opacity: hovered && (isIdle || isComplete) ? 1 : 0 }}
            transition={{ duration: 0.25 }} />
        </motion.div>
      </div>

      {dropdown}

      {/* House number fields */}
      <AnimatePresence>
        {isComplete && pickup?.street && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }} style={{ overflow: 'hidden', marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ margin: 0, fontSize: 12, whiteSpace: 'nowrap', color: 'rgba(255,209,0,0.8)' }}>מספר בית (איסוף):</label>
              <input type="text" placeholder="7" value={pickupHouseNumber}
                onChange={e => onPickupHouseNumberChange(e.target.value)}
                style={{ width: 70, padding: '6px 10px', fontSize: 14 }} />
            </div>
            {destination?.street && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ margin: 0, fontSize: 12, whiteSpace: 'nowrap', color: 'rgba(59,130,246,0.8)' }}>מספר בית (יעד):</label>
                <input type="text" placeholder="7" value={destinationHouseNumber}
                  onChange={e => onDestinationHouseNumberChange(e.target.value)}
                  style={{ width: 70, padding: '6px 10px', fontSize: 14 }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── SearchField sub-component ────────────────────────────────────
import { forwardRef } from 'react'

const SearchField = forwardRef<HTMLInputElement, {
  label: string; labelColor: string; placeholder: string
  query: string; loading: boolean
  onChange: (v: string) => void; onFocus: () => void
}>(({ label, labelColor, placeholder, query, loading, onChange, onFocus }, ref) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ position: 'relative' }}>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        autoComplete="off"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${labelColor}44`,
          borderRadius: 10, color: '#F2F2F2',
          padding: '9px 14px', fontSize: 14, outline: 'none', direction: 'rtl',
        }}
      />
      {loading && (
        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#555' }}>
          מחפש...
        </motion.div>
      )}
    </div>
  </div>
))
SearchField.displayName = 'SearchField'
