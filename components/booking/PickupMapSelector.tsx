'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import MapPickerModal from './MapPickerModal'

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
  label = 'כתובת איסוף *',
  pinColor = '#FFD100',
  badgeLabel = 'כתובת איסוף',
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [markerCoords, setMarkerCoords] = useState<{ lat: number; lng: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-40, 40], [4, -4])
  const rotateY = useTransform(mouseX, [-40, 40], [-4, 4])
  const springRX = useSpring(rotateX, { stiffness: 280, damping: 28 })
  const springRY = useSpring(rotateY, { stiffness: 280, damping: 28 })

  // Static map tile URL based on coords
  const tileUrl = markerCoords
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${markerCoords.lat},${markerCoords.lng}&zoom=15&size=400x160`
    : null

  useEffect(() => {
    if (!value && !selected) { setMarkerCoords(null) }
  }, [value, selected])

  function onMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (r.left + r.width / 2))
    mouseY.set(e.clientY - (r.top + r.height / 2))
  }
  function onMouseLeave() { mouseX.set(0); mouseY.set(0); setHovered(false) }

  function handleConfirm(parsed: ParsedAddress, lat: number, lng: number) {
    setMarkerCoords({ lat, lng })
    onSelect(parsed)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onClear()
    setMarkerCoords(null)
  }

  const isSelected = !!selected
  const fullAddress = selected
    ? [selected.street, selected.houseNumber || houseNumber, selected.city].filter(Boolean).join(' ')
    : ''

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 8 }}>{label}</label>

      <div ref={containerRef} style={{ perspective: '1000px' }}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={onMouseLeave}
      >
        <motion.div
          style={{
            rotateX: springRX, rotateY: springRY,
            transformStyle: 'preserve-3d',
            position: 'relative', overflow: 'hidden',
            borderRadius: 14, height: 150, background: '#0d0d0d',
            cursor: 'pointer', userSelect: 'none',
          }}
          animate={{
            borderColor: isSelected
              ? hovered ? 'rgba(255,209,0,0.5)' : 'rgba(255,209,0,0.25)'
              : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.09)',
            boxShadow: isSelected
              ? '0 4px 24px rgba(255,209,0,0.12)'
              : '0 4px 20px rgba(0,0,0,0.4)',
          }}
          transition={{ duration: 0.22 }}
          onClick={() => setModalOpen(true)}
          whileTap={{ scale: 0.985 }}
        >
          {/* Real map tile (after address selected) */}
          <AnimatePresence>
            {isSelected && tileUrl && (
              <motion.img
                key="tile"
                src={tileUrl}
                alt="map"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.6) saturate(0.5)',
                }}
              />
            )}
          </AnimatePresence>

          {/* SVG decorative map (always shown as fallback) */}
          {!tileUrl && (
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
          )}

          {/* Buildings (idle) */}
          {!isSelected && !tileUrl && [
            [42,8,12,23,0.3], [12,33,10,18,0.4], [70,70,14,20,0.5],
            [14,82,9,24,0.35], [54,3,7,10,0.45], [7,71,11,9,0.55],
          ].map(([top,left,w,h,d],i) => (
            <motion.div key={i} style={{
              position: 'absolute', top: `${top}%`, left: `${left}%`,
              width: `${w}%`, height: `${h}%`, borderRadius: 3,
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(255,255,255,0.03)',
            }}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: d }} />
          ))}

          {/* Gradient overlays */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,13,13,0.95) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(13,13,13,0.7) 0%, transparent 60%)', pointerEvents: 'none' }} />

          {/* Pin */}
          <AnimatePresence>
            <motion.div
              key="pin"
              style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -60%)', zIndex: 10, pointerEvents: 'none' }}
              initial={{ scale: 0, y: -16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, y: -10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            >
              <motion.div
                animate={!isSelected ? { y: [0, -7, 0] } : {}}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg width="28" height="36" viewBox="0 0 24 30" fill="none"
                  style={{ filter: `drop-shadow(0 2px 10px ${pinColor}99)` }}>
                  <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z"
                    fill={isSelected ? pinColor : `${pinColor}77`} />
                  <circle cx="12" cy="9" r="3.5" fill="#0d0d0d" />
                </svg>
              </motion.div>
              <motion.div style={{
                position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
                width: 18, height: 6, borderRadius: '50%', background: `${pinColor}44`,
              }}
                animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </AnimatePresence>

          {/* IDLE: tap to select */}
          <AnimatePresence>
            {!isSelected && (
              <motion.div key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 7, zIndex: 10, paddingBottom: 14 }}
              >
                <motion.div
                  animate={{ scale: hovered ? 1.05 : [1, 1.03, 1] }}
                  transition={hovered ? { duration: 0.15 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    background: `${pinColor}18`, border: `1px solid ${pinColor}44`,
                    borderRadius: 24, padding: '7px 20px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <span style={{ fontSize: 14 }}>🗺️</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: pinColor }}>לחץ לבחירת כתובת</span>
                </motion.div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{badgeLabel}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SELECTED: address + edit hint */}
          <AnimatePresence>
            {isSelected && (
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
                  <span style={{ fontSize: 10, fontWeight: 700, color: pinColor, letterSpacing: '0.4px' }}>{badgeLabel}</span>
                </motion.div>

                {/* Edit hint + clear */}
                <motion.div key="actions"
                  initial={{ opacity: 0 }} animate={{ opacity: hovered ? 1 : 0 }} exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', top: 10, left: 12, zIndex: 10,
                    display: 'flex', gap: 6,
                  }}
                >
                  <div style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '3px 10px',
                    fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    pointerEvents: 'none',
                  }}>
                    ✏️ <span>לחץ לשינוי</span>
                  </div>
                  <button type="button"
                    onClick={handleClear}
                    style={{
                      background: 'rgba(255,60,60,0.12)', border: '1px solid rgba(255,60,60,0.2)',
                      borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                      color: 'rgba(255,100,100,0.8)', cursor: 'pointer',
                    }}>✕</button>
                </motion.div>

                {/* Address bottom */}
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

          {/* Hover shimmer */}
          <motion.div
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at 50% 50%, ${pinColor}08 0%, transparent 70%)` }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          />
        </motion.div>
      </div>

      {/* House number (after selection) */}
      <AnimatePresence>
        {isSelected && selected?.street && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
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

      <MapPickerModal
        open={modalOpen}
        initialLat={markerCoords?.lat}
        initialLng={markerCoords?.lng}
        pinColor={pinColor}
        label={badgeLabel}
        onConfirm={handleConfirm}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
