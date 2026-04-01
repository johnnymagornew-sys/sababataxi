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
}

export default function PickupMapSelector({
  value, selected, onSelect, onClear,
  houseNumber, onHouseNumberChange,
  priceChip, label = 'כתובת איסוף *',
  placeholder = 'הקלד כתובת: רחוב ומספר, עיר...',
  badgeLabel = 'כתובת איסוף',
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'searching' | 'selected'>(selected ? 'selected' : 'idle')
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-40, 40], [4, -4])
  const rotateY = useTransform(mouseX, [-40, 40], [-4, 4])
  const springRX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  // Sync external reset
  useEffect(() => {
    if (!value && !selected) { setPhase('idle'); setQuery('') }
  }, [value, selected])

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (r.left + r.width / 2))
    mouseY.set(e.clientY - (r.top + r.height / 2))
  }
  function handleMouseLeave() { mouseX.set(0); mouseY.set(0) }

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=il&limit=6&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
      )
      setResults(await res.json())
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  function handleChange(val: string) {
    setQuery(val)
    onClear()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 400)
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
    }
  }

  function handleSelect(r: NominatimResult) {
    const a = r.address
    const city = a.city || a.town || a.village || a.municipality || a.suburb || a.neighbourhood || a.county || ''
    const street = a.road || ''
    const num = a.house_number || query.match(/\b(\d+)\b/)?.[1] || ''
    const display = [street, num, city].filter(Boolean).join(' ')
    setQuery(display)
    setResults([])
    setPhase('selected')
    onSelect({ city, street, houseNumber: num, displayName: display })
  }

  function openSearch() {
    setPhase('searching')
    setTimeout(() => inputRef.current?.focus(), 120)
  }

  function closeSearch() {
    if (selected) { setPhase('selected') }
    else { setPhase('idle') }
    setResults([])
  }

  const dropdown = results.length > 0 && dropdownRect && phase === 'searching'
    ? createPortal(
        <div style={{
          position: 'absolute', top: dropdownRect.top, left: dropdownRect.left,
          width: dropdownRect.width, background: 'var(--card2)', border: '1px solid var(--border)',
          borderRadius: 10, zIndex: 9999, boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {results.map(r => {
            const a = r.address
            const city = a.city || a.town || a.village || a.municipality || ''
            const street = a.road || ''
            const house = a.house_number || ''
            const line1 = [street, house].filter(Boolean).join(' ') || city
            const line2 = line1 !== city ? city : ''
            return (
              <div key={r.place_id}
                onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
                style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
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
      )
    : null

  const fullAddress = selected
    ? [selected.street, selected.houseNumber, selected.city].filter(Boolean).join(' ')
    : ''

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 8 }}>{label}</label>

      <motion.div
        ref={containerRef}
        style={{ perspective: 1000 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          style={{
            rotateX: springRX,
            rotateY: springRY,
            transformStyle: 'preserve-3d',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 14,
            height: 120,
            cursor: phase === 'idle' ? 'pointer' : 'default',
            background: '#0f0f0f',
          }}
          animate={{
            borderColor: phase === 'searching'
              ? 'rgba(255,209,0,0.5)'
              : phase === 'selected'
              ? 'rgba(255,209,0,0.25)'
              : 'rgba(255,255,255,0.1)',
            boxShadow: phase === 'searching'
              ? '0 0 0 3px rgba(255,209,0,0.12), 0 8px 32px rgba(0,0,0,0.5)'
              : '0 4px 20px rgba(0,0,0,0.4)',
          }}
          transition={{ duration: 0.3 }}
          onClick={() => { if (phase === 'idle') openSearch() }}
          whileTap={phase === 'idle' ? { scale: 0.98 } : {}}
        >
          {/* ── Map background (always) ── */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
            <motion.line x1="0%" y1="38%" x2="100%" y2="38%" stroke="rgba(255,255,255,0.1)" strokeWidth="3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.1 }} />
            <motion.line x1="0%" y1="68%" x2="100%" y2="68%" stroke="rgba(255,255,255,0.1)" strokeWidth="3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.2 }} />
            <motion.line x1="28%" y1="0%" x2="28%" y2="100%" stroke="rgba(255,255,255,0.07)" strokeWidth="2"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.3 }} />
            <motion.line x1="65%" y1="0%" x2="65%" y2="100%" stroke="rgba(255,255,255,0.07)" strokeWidth="2"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.35 }} />
            {[18, 55, 82].map((y, i) => (
              <motion.line key={`h${i}`} x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }} />
            ))}
            {[12, 44, 80].map((x, i) => (
              <motion.line key={`v${i}`} x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%"
                stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }} />
            ))}
          </svg>

          {/* Buildings */}
          {[
            { top: '42%', left: '8%', w: '12%', h: '22%', d: 0.3 },
            { top: '12%', left: '33%', w: '10%', h: '18%', d: 0.4 },
            { top: '72%', left: '70%', w: '14%', h: '20%', d: 0.5 },
            { top: '15%', left: '82%', w: '9%', h: '24%', d: 0.35 },
            { top: '55%', left: '3%', w: '7%', h: '10%', d: 0.45 },
            { top: '8%', left: '72%', w: '11%', h: '9%', d: 0.55 },
          ].map((b, i) => (
            <motion.div key={i} style={{
              position: 'absolute', top: b.top, left: b.left, width: b.w, height: b.h,
              borderRadius: 3, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.03)',
            }}
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: b.d }} />
          ))}

          {/* Pin — animated in idle, static in selected */}
          <AnimatePresence>
            {phase !== 'searching' && (
              <motion.div
                key="pin"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', zIndex: 10 }}
                initial={{ scale: 0, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0, y: -10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                {/* bounce animation for idle */}
                <motion.div
                  animate={phase === 'idle' ? { y: [0, -6, 0] } : {}}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="28" height="34" viewBox="0 0 24 30" fill="none"
                    style={{ filter: `drop-shadow(0 0 ${phase === 'selected' ? '10px' : '6px'} rgba(255,209,0,${phase === 'selected' ? '0.7' : '0.4'}))` }}>
                    <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z"
                      fill={phase === 'selected' ? '#FFD100' : 'rgba(255,209,0,0.5)'} />
                    <circle cx="12" cy="9" r="3.5" fill="#0f0f0f" />
                  </svg>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse ring */}
          {phase !== 'searching' && (
            <motion.div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -5%)', width: 18, height: 7,
              borderRadius: '50%', background: 'rgba(255,209,0,0.25)',
            }}
              animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Gradient overlays */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,15,15,0.9) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(15,15,15,0.7) 0%, transparent 55%)', pointerEvents: 'none' }} />

          {/* ── IDLE state content ── */}
          <AnimatePresence>
            {phase === 'idle' && (
              <motion.div key="idle-content"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 10 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    background: 'rgba(255,209,0,0.12)', border: '1px solid rgba(255,209,0,0.3)',
                    borderRadius: 24, padding: '7px 18px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📍</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#FFD100' }}>לחץ לבחירת כתובת</span>
                </motion.div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>כתובת האיסוף שלך</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SEARCHING state content ── */}
          <AnimatePresence>
            {phase === 'searching' && (
              <motion.div key="search-content"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 8, background: 'rgba(15,15,15,0.92)' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD100', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {label}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => handleChange(e.target.value)}
                    onFocus={() => {
                      if (inputRef.current) {
                        const rect = inputRef.current.getBoundingClientRect()
                        setDropdownRect({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
                      }
                    }}
                    autoComplete="off"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,209,0,0.3)',
                      borderRadius: 10, color: 'var(--txt)',
                      padding: '10px 14px', fontSize: 15, outline: 'none',
                    }}
                  />
                  {loading && (
                    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--txt2)' }}>
                      מחפש...
                    </div>
                  )}
                </div>
                <button type="button" onClick={closeSearch}
                  style={{ position: 'absolute', top: 10, left: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SELECTED state content ── */}
          <AnimatePresence>
            {phase === 'selected' && (
              <motion.div key="selected-content"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ position: 'absolute', zIndex: 10 }}
              >
                {/* Edit button */}
                <motion.button type="button"
                  onClick={openSearch}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    position: 'absolute', top: 10, left: 12,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12,
                    cursor: 'pointer', padding: '3px 10px', fontWeight: 600,
                  }}>
                  ✏️ שנה
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Address text bottom-right */}
          <AnimatePresence>
            {phase === 'selected' && (
              <motion.div key="address-text"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ position: 'absolute', bottom: 12, right: 14, zIndex: 10, textAlign: 'right', direction: 'rtl' }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: '#F2F2F2', lineHeight: 1.3, marginBottom: 4 }}>
                  {fullAddress}
                </div>
                {priceChip}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badge top-right for selected */}
          <AnimatePresence>
            {phase === 'selected' && (
              <motion.div key="badge"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  position: 'absolute', top: 10, right: 12, zIndex: 10,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,209,0,0.1)', border: '1px solid rgba(255,209,0,0.2)',
                  borderRadius: 20, padding: '3px 10px',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD100' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#FFD100', letterSpacing: '0.4px' }}>{badgeLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {dropdown}

      {/* House number input after selection */}
      <AnimatePresence>
        {phase === 'selected' && selected?.street && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', marginTop: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 12 }}>מספר בית:</label>
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
