'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { ParsedAddress } from './PickupMapSelector'

interface Props {
  open: boolean
  initialLat?: number
  initialLng?: number
  pinColor?: string
  label?: string
  onConfirm: (parsed: ParsedAddress, lat: number, lng: number) => void
  onClose: () => void
}

interface NominatimResult {
  display_name: string
  address: {
    road?: string; house_number?: string; city?: string; town?: string
    village?: string; suburb?: string; municipality?: string
    county?: string; neighbourhood?: string
  }
}

const ISRAEL_LAT = 31.76
const ISRAEL_LNG = 34.95
const ISRAEL_ZOOM = 8

export default function MapPickerModal({ open, initialLat, initialLng, pinColor = '#FFD100', label = 'כתובת איסוף', onConfirm, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const [address, setAddress] = useState<ParsedAddress | null>(null)
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true)
    setAddress(null)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
      )
      const data: NominatimResult = await r.json()
      const a = data.address
      const city = a.city || a.town || a.village || a.municipality || a.suburb || a.neighbourhood || a.county || ''
      const street = a.road || ''
      const houseNumber = a.house_number || ''
      const displayName = [street, houseNumber, city].filter(Boolean).join(' ')
      setAddress({ city, street, houseNumber, displayName })
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  // Init Leaflet map
  useEffect(() => {
    if (!open || !mapRef.current || mapInstanceRef.current) return

    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return

      // Fix default icon paths for Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const startLat = initialLat ?? ISRAEL_LAT
      const startLng = initialLng ?? ISRAEL_LNG
      const startZoom = (initialLat && initialLng) ? 15 : ISRAEL_ZOOM

      const map = L.map(mapRef.current!, {
        center: [startLat, startLng],
        zoom: startZoom,
        zoomControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Custom pin icon
      const pinIcon = L.divIcon({
        html: `<svg width="32" height="40" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z" fill="${pinColor}"/>
          <circle cx="12" cy="9" r="3.5" fill="#0d0d0d"/>
        </svg>`,
        className: '',
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      })

      let marker: ReturnType<typeof L.marker> | null = null

      if (initialLat && initialLng) {
        marker = L.marker([initialLat, initialLng], { icon: pinIcon }).addTo(map)
        markerRef.current = marker
        setMarkerPos({ lat: initialLat, lng: initialLng })
        reverseGeocode(initialLat, initialLng)
      }

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
        }
        setMarkerPos({ lat, lng })
        reverseGeocode(lat, lng)
      })

      // Zoom controls
      L.control.zoom({ position: 'bottomleft' }).addTo(map)

      mapInstanceRef.current = map
    })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Cleanup on close
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      setAddress(null)
      setMarkerPos(null)
      setQuery('')
      setSearchResults([])
    }
  }, [open])

  // Text search
  function handleSearch(val: string) {
    setQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.length < 3) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&addressdetails=1&countrycodes=il&limit=5&accept-language=he`,
          { headers: { 'Accept-Language': 'he' } }
        )
        const data = await r.json()
        setSearchResults(data)
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 400)
  }

  function selectSearchResult(r: NominatimResult & { lat: string; lon: string }) {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const a = r.address
    const city = a.city || a.town || a.village || a.municipality || a.suburb || a.neighbourhood || a.county || ''
    const street = a.road || ''
    const houseNumber = a.house_number || ''
    const displayName = [street, houseNumber, city].filter(Boolean).join(' ')
    setAddress({ city, street, houseNumber, displayName })
    setMarkerPos({ lat, lng })
    setSearchResults([])
    setQuery(displayName)

    import('leaflet').then(L => {
      if (!mapInstanceRef.current) return
      const pinIcon = L.divIcon({
        html: `<svg width="32" height="40" viewBox="0 0 24 30" fill="none"><path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z" fill="${pinColor}"/><circle cx="12" cy="9" r="3.5" fill="#0d0d0d"/></svg>`,
        className: '', iconSize: [32, 40], iconAnchor: [16, 40],
      })
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(mapInstanceRef.current)
      }
      mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1 })
    })
  }

  function handleConfirm() {
    if (!address || !markerPos) return
    onConfirm(address, markerPos.lat, markerPos.lng)
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            background: '#0d0d0d',
          }}
        >
          {/* Header */}
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
              padding: '12px 16px 8px',
              background: 'linear-gradient(to bottom, rgba(13,13,13,0.98) 0%, rgba(13,13,13,0.85) 100%)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <button type="button" onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.7)',
                  fontSize: 18, cursor: 'pointer', padding: '6px 12px', lineHeight: 1,
                  flexShrink: 0,
                }}>✕</button>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: pinColor }}>{label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>חפש כתובת או לחץ על המפה</div>
              </div>
            </div>

            {/* Search input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="חפש כתובת: רחוב ומספר, עיר..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
                dir="rtl"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.09)',
                  border: `1.5px solid ${query ? pinColor + '66' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 12, color: '#F2F2F2',
                  padding: '12px 16px', fontSize: 15, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
              {searching && (
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#666' }}>
                  ⟳
                </div>
              )}
            </div>

            {/* Search results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  style={{
                    position: 'absolute', top: '100%', left: 16, right: 16,
                    background: '#1a1a1a', borderRadius: 12,
                    border: '1px solid rgba(255,209,0,0.2)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
                    zIndex: 20, overflow: 'hidden',
                  }}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {searchResults.map((r: any, i: number) => {
                    const a = r.address
                    const city = a.city || a.town || a.village || a.municipality || ''
                    const street = a.road || ''
                    const house = a.house_number || ''
                    const line1 = [street, house].filter(Boolean).join(' ') || city
                    const line2 = line1 !== city ? city : ''
                    return (
                      <div key={i}
                        onMouseDown={e => { e.preventDefault(); selectSearchResult(r) }}
                        style={{
                          padding: '12px 16px', cursor: 'pointer',
                          borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          display: 'flex', alignItems: 'center', gap: 10,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,209,0,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: 14, color: pinColor, flexShrink: 0 }}>📍</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#F2F2F2' }}>{line1}</div>
                          {line2 && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{line2}</div>}
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Map */}
          <div ref={mapRef} style={{ flex: 1, width: '100%' }} />

          {/* Leaflet CSS */}
          <style>{`
            .leaflet-container { background: #1a1a1a; }
            .leaflet-tile-pane { filter: brightness(0.85) saturate(0.7) hue-rotate(200deg); }
            .leaflet-control-zoom { border: none !important; }
            .leaflet-control-zoom a {
              background: rgba(20,20,20,0.9) !important;
              color: #FFD100 !important;
              border: 1px solid rgba(255,209,0,0.2) !important;
              font-size: 18px !important;
              line-height: 30px !important;
            }
            .leaflet-control-zoom a:hover { background: rgba(255,209,0,0.15) !important; }
            .leaflet-control-attribution { display: none; }
          `}</style>

          {/* Bottom confirmation */}
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
              padding: '16px 16px 32px',
              background: 'linear-gradient(to top, rgba(13,13,13,0.99) 0%, rgba(13,13,13,0.88) 80%, transparent 100%)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Address preview */}
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 12 }}>
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    מאתר כתובת...
                  </motion.span>
                </motion.div>
              )}
              {!loading && !address && (
                <motion.div key="hint"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 12 }}>
                  לחץ על המפה לסימון מיקום
                </motion.div>
              )}
              {!loading && address && (
                <motion.div key="addr"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  style={{
                    background: 'rgba(255,209,0,0.1)',
                    border: `1px solid ${pinColor}33`,
                    borderRadius: 12, padding: '10px 14px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>
                      {[address.street, address.houseNumber].filter(Boolean).join(' ') || address.city}
                    </div>
                    {address.city && (address.street ? (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{address.city}</div>
                    ) : null)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              onClick={handleConfirm}
              disabled={!address || loading}
              whileTap={address && !loading ? { scale: 0.97 } : {}}
              style={{
                width: '100%', padding: '16px', borderRadius: 14,
                background: address && !loading
                  ? `linear-gradient(135deg, #E9C400 0%, ${pinColor} 100%)`
                  : 'rgba(255,255,255,0.07)',
                border: 'none', cursor: address && !loading ? 'pointer' : 'not-allowed',
                color: address && !loading ? '#221B00' : 'rgba(255,255,255,0.25)',
                fontWeight: 900, fontSize: 17, fontFamily: 'var(--font-headline, sans-serif)',
                boxShadow: address && !loading ? '0 8px 32px rgba(233,196,0,0.25)' : 'none',
                transition: 'all 0.2s',
                letterSpacing: '-0.3px',
              }}
            >
              {address ? '✓ אישור הכתובת' : 'בחר מיקום על המפה'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
