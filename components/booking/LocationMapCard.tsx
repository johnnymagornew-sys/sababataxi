'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'

interface LocationMapCardProps {
  city: string
  street?: string
  houseNumber?: string
  priceChip?: React.ReactNode
}

export default function LocationMapCard({ city, street, houseNumber, priceChip }: LocationMapCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-50, 50], [5, -5])
  const rotateY = useTransform(mouseX, [-50, 50], [-5, 5])
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (rect.left + rect.width / 2))
    mouseY.set(e.clientY - (rect.top + rect.height / 2))
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setIsHovered(false)
  }

  const fullAddress = street
    ? `${street}${houseNumber ? ' ' + houseNumber : ''}, ${city}`
    : city

  return (
    <motion.div
      ref={containerRef}
      style={{ perspective: 1000, width: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <motion.div
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: 'preserve-3d',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 14,
          background: '#141414',
          border: `1px solid ${isHovered ? 'rgba(255,209,0,0.25)' : 'rgba(255,255,255,0.08)'}`,
          height: 120,
          width: '100%',
          cursor: 'default',
          transition: 'border-color 0.25s',
        }}
      >
        {/* Map background */}
        <div style={{ position: 'absolute', inset: 0, background: '#111' }} />

        {/* Animated roads */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
          {/* Main horizontal roads */}
          <motion.line x1="0%" y1="38%" x2="100%" y2="38%"
            stroke="rgba(255,255,255,0.12)" strokeWidth="3"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }} />
          <motion.line x1="0%" y1="68%" x2="100%" y2="68%"
            stroke="rgba(255,255,255,0.12)" strokeWidth="3"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }} />

          {/* Vertical roads */}
          <motion.line x1="28%" y1="0%" x2="28%" y2="100%"
            stroke="rgba(255,255,255,0.09)" strokeWidth="2"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }} />
          <motion.line x1="65%" y1="0%" x2="65%" y2="100%"
            stroke="rgba(255,255,255,0.09)" strokeWidth="2"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }} />

          {/* Secondary streets */}
          {[18, 55, 82].map((y, i) => (
            <motion.line key={`h${i}`} x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1.5"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }} />
          ))}
          {[12, 44, 80].map((x, i) => (
            <motion.line key={`v${i}`} x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%"
              stroke="rgba(255,255,255,0.05)" strokeWidth="1.5"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }} />
          ))}
        </svg>

        {/* Buildings */}
        {[
          { top: '42%', left: '8%', w: '13%', h: '22%', delay: 0.3 },
          { top: '12%', left: '33%', w: '10%', h: '18%', delay: 0.4 },
          { top: '72%', left: '70%', w: '16%', h: '20%', delay: 0.5 },
          { top: '15%', right: '8%', w: '9%', h: '24%', delay: 0.35 },
          { top: '55%', left: '3%', w: '7%', h: '10%', delay: 0.45 },
          { top: '8%', left: '72%', w: '12%', h: '9%', delay: 0.55 },
        ].map((b, i) => (
          <motion.div key={i}
            style={{
              position: 'absolute',
              top: b.top, left: b.left, right: (b as { right?: string }).right,
              width: b.w, height: b.h,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: b.delay }}
          />
        ))}

        {/* Pin marker centered */}
        <motion.div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -60%)',
            zIndex: 10,
          }}
          initial={{ scale: 0, y: -15 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 450, damping: 18, delay: 0.2 }}
        >
          <svg width="30" height="36" viewBox="0 0 24 30" fill="none"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255,209,0,0.6))' }}>
            <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z"
              fill="#FFD100" />
            <circle cx="12" cy="9" r="3.5" fill="#141414" />
          </svg>
        </motion.div>

        {/* Pulse ring under pin */}
        <motion.div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -5%)',
            width: 20, height: 8,
            borderRadius: '50%',
            background: 'rgba(255,209,0,0.2)',
          }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Gradient overlay bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(20,20,20,0.85) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        {/* Gradient overlay right (for RTL text) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to left, rgba(20,20,20,0.7) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />

        {/* Content — bottom right (RTL: bottom start) */}
        <div style={{
          position: 'absolute', bottom: 12, right: 14,
          zIndex: 10, textAlign: 'right', direction: 'rtl',
        }}>
          <motion.div
            style={{ fontSize: 15, fontWeight: 800, color: '#F2F2F2', lineHeight: 1.2, marginBottom: 3 }}
            animate={{ x: isHovered ? -3 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {fullAddress}
          </motion.div>
          {priceChip && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              style={{ display: 'inline-flex' }}
            >
              {priceChip}
            </motion.div>
          )}
        </div>

        {/* Top-left badge */}
        <div style={{
          position: 'absolute', top: 10, left: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,209,0,0.1)',
          border: '1px solid rgba(255,209,0,0.2)',
          borderRadius: 20, padding: '3px 10px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD100' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FFD100', letterSpacing: '0.4px' }}>
            כתובת איסוף
          </span>
        </div>

        {/* Hover glow */}
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,209,0,0.03)',
            pointerEvents: 'none',
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        />
      </motion.div>
    </motion.div>
  )
}
