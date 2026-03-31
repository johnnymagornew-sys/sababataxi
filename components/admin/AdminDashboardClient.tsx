'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking, Driver } from '@/types/database'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

type AdminTab = 'dashboard' | 'bookings' | 'drivers' | 'credits' | 'revenue' | 'history' | 'leads'

type Lead = { id: string; name: string; phone: string; email: string | null; created_at: string; converted: boolean }

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין', approved: 'מאושר', claimed: 'שורין',
  completed: 'הושלם', rejected: 'נדחה', cancelled: 'בוטל',
}
const STATUS_COLORS: Record<string, string> = {
  pending: '#FFD100', approved: '#27AE60', claimed: '#3B82F6',
  completed: '#6B7280', rejected: '#EF4444', cancelled: '#6B7280',
}

export default function AdminDashboardClient({
  initialBookings,
  initialDrivers,
  initialLeads = [],
}: {
  initialBookings: Booking[]
  initialDrivers: Driver[]
  initialLeads?: Lead[]
}) {
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const [creditInputs, setCreditInputs] = useState<{ driverId: string; amount: string; notes: string }>({ driverId: '', amount: '', notes: '' })
  const [loadingCredit, setLoadingCredit] = useState(false)
  const [newDriver, setNewDriver] = useState({ email: '', password: '', full_name: '', phone: '', vehicle_type: 'regular', vehicle_number: '', vehicle_model: '' })
  const [editingDriver, setEditingDriver] = useState<string | null>(null)
  const [editDriverData, setEditDriverData] = useState<{ vehicle_type: string; vehicle_number: string; vehicle_model: string }>({ vehicle_type: 'regular', vehicle_number: '', vehicle_model: '' })
  const [creatingDriver, setCreatingDriver] = useState(false)
  const [showNewDriverForm, setShowNewDriverForm] = useState(false)
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [revenue, setRevenue] = useState<{ subscriptions: number; credits: number; rides: number } | null>(null)
  const [loadingRevenue, setLoadingRevenue] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const activeDrivers = drivers.filter(d => d.subscription_active && d.is_active).length
  const todayRides = bookings.filter(b => {
    const today = new Date().toISOString().split('T')[0]
    return b.travel_date === today && ['approved', 'claimed', 'completed'].includes(b.status)
  }).length
  const monthRevenue = bookings
    .filter(b => {
      const m = new Date().toISOString().slice(0, 7)
      if (!b.created_at?.startsWith(m)) return false
      if (b.status !== 'claimed' && b.status !== 'completed') return false
      // Only count if ride time has already passed
      const rideDateTime = new Date(`${b.travel_date}T${b.travel_time}`)
      return rideDateTime <= new Date()
    })
    .reduce((s, b) => s + (b.price || 0), 0)

  function showMsg(text: string, type: 'ok' | 'err') {
    setActionMsg({ text, type })
    setTimeout(() => setActionMsg(null), 4000)
  }

  async function updateBookingStatus(id: string, status: string) {
    const res = await fetch('/api/admin/update-booking-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, status }),
    })
    if (!res.ok) { showMsg('שגיאה בעדכון', 'err'); return }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as Booking['status'] } : b))
    showMsg(`סטטוס עודכן: ${STATUS_LABELS[status]}`, 'ok')
  }

  async function saveDriverEdit(driverId: string) {
    const { error } = await supabase.from('drivers').update({
      vehicle_type: editDriverData.vehicle_type as Driver['vehicle_type'],
      vehicle_number: editDriverData.vehicle_number || null,
      vehicle_model: editDriverData.vehicle_model || null,
    }).eq('id', driverId)
    if (error) { showMsg('שגיאה בעדכון', 'err'); return }
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, vehicle_type: editDriverData.vehicle_type as Driver['vehicle_type'], vehicle_number: editDriverData.vehicle_number, vehicle_model: editDriverData.vehicle_model } : d))
    setEditingDriver(null)
    showMsg('פרטי רכב עודכנו', 'ok')
  }

  async function toggleSubscription(driver: Driver) {
    const newVal = !driver.subscription_active
    const expires = newVal ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    const { error } = await supabase.from('drivers').update({
      subscription_active: newVal,
      subscription_expires_at: expires,
    }).eq('id', driver.id)
    if (error) { showMsg('שגיאה בעדכון מנוי', 'err'); return }
    // Log subscription payment when activating
    if (newVal) {
      await supabase.from('subscription_payments').insert({ driver_id: driver.id, amount: 300 })
    }
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, subscription_active: newVal } : d))
  }

  async function loadRevenue() {
    setLoadingRevenue(true)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'
    const [subRes, creditRes] = await Promise.all([
      supabase.from('subscription_payments').select('amount').gte('paid_at', monthStart),
      supabase.from('credit_transactions').select('amount').eq('type', 'admin_load').gte('created_at', monthStart),
    ])
    const subscriptions = (subRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
    const credits = (creditRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
    const rides = bookings.filter(b => {
      if (b.status !== 'claimed' && b.status !== 'completed') return false
      const rideTime = new Date(`${b.travel_date}T${b.travel_time}`)
      return rideTime <= new Date()
    }).reduce((s, b) => s + (b.price || 0), 0)
    setRevenue({ subscriptions, credits, rides })
    setLoadingRevenue(false)
  }

  async function loadCredit() {
    const amount = parseFloat(creditInputs.amount)
    if (!creditInputs.driverId) { showMsg('בחר נהג', 'err'); return }
    if (isNaN(amount) || amount <= 0) { showMsg('הכנס סכום תקין', 'err'); return }
    setLoadingCredit(true)
    const { data } = await supabase.rpc('admin_load_credits', {
      p_driver_id: creditInputs.driverId,
      p_amount: amount,
      p_notes: creditInputs.notes || undefined,
    })
    setLoadingCredit(false)
    if (!data?.success) { showMsg('שגיאה בטעינת קרדיט', 'err'); return }
    const d = drivers.find(dr => dr.id === creditInputs.driverId)
    setDrivers(prev => prev.map(dr => dr.id === creditInputs.driverId ? { ...dr, credits: dr.credits + amount } : dr))
    setCreditInputs({ driverId: '', amount: '', notes: '' })
    showMsg(`₪${amount} נוספו ל${d?.full_name ?? 'נהג'}`, 'ok')
  }

  async function createDriver() {
    const { email, password, full_name, phone, vehicle_type } = newDriver
    if (!email || !password || !full_name || !phone) { showMsg('מלא את כל השדות', 'err'); return }
    setCreatingDriver(true)
    try {
      const res = await fetch('/api/admin/create-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, phone, vehicle_type, vehicle_number: newDriver.vehicle_number, vehicle_model: newDriver.vehicle_model }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Reload drivers list
      const { data: updated } = await supabase.from('drivers').select('*').order('full_name')
      if (updated) setDrivers(updated as Driver[])
      setNewDriver({ email: '', password: '', full_name: '', phone: '', vehicle_type: 'regular', vehicle_number: '', vehicle_model: '' })
      setShowNewDriverForm(false)
      showMsg(`נהג ${full_name} נוצר בהצלחה!`, 'ok')
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : 'שגיאה ביצירת נהג', 'err')
    } finally {
      setCreatingDriver(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredBookings = statusFilter === 'all' ? bookings : bookings.filter(b => b.status === statusFilter)

  const sidebarItems: { key: AdminTab; icon: string; label: string; badge?: number }[] = [
    { key: 'dashboard', icon: '📊', label: 'דשבורד' },
    { key: 'bookings', icon: '🗂', label: 'הזמנות', badge: pendingCount || undefined },
    { key: 'drivers', icon: '👥', label: 'נהגים' },
    { key: 'credits', icon: '💰', label: 'קרדיטים' },
    { key: 'revenue', icon: '📈', label: 'רווחים' },
    { key: 'history', icon: '📋', label: 'היסטוריה' },
    { key: 'leads', icon: '🎯', label: 'לידים' },
  ]

  return (
    <>
      <style>{`
        .admin-wrap { min-height: 100vh; background: #111; color: #F2F2F2; font-family: 'Heebo', sans-serif; direction: rtl; }
        .admin-wrap::after {
          content: '';
          position: fixed; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px);
          background-size: 56px 56px;
          pointer-events: none; z-index: 0;
        }
        .admin-wrap::before {
          content: '';
          position: fixed; top: -120px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 300px;
          background: radial-gradient(ellipse, rgba(255,209,0,0.06) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .admin-header {
          position: sticky; top: 0; z-index: 100;
          background: rgba(14,14,14,0.95); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 24px; height: 62px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .admin-logo { display: flex; align-items: center; gap: 10px; }
        .admin-logo-mark { background: #FFD100; color: #0E0E0E; font-weight: 800; font-size: 18px; padding: 4px 10px; border-radius: 8px; }
        .admin-logo-text { font-weight: 800; font-size: 18px; letter-spacing: -0.5px; }
        .admin-logo-text span { color: #FFD100; }
        .btn-ghost-sm {
          background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #888;
          border-radius: 8px; padding: 7px 14px; cursor: pointer;
          font-family: 'Heebo', sans-serif; font-size: 13px; font-weight: 600;
          transition: all 0.15s;
        }
        .btn-ghost-sm:hover { border-color: rgba(255,255,255,0.2); color: #F2F2F2; }
        .btn-ghost-red { border-color: rgba(231,76,60,0.25); color: #E74C3C; }
        .admin-layout { display: flex; min-height: calc(100vh - 62px); position: relative; z-index: 1; }
        .admin-sidebar {
          width: 218px; flex-shrink: 0;
          background: #191919; border-left: 1px solid rgba(255,255,255,0.06);
          padding: 18px 0; position: sticky; top: 62px;
          height: calc(100vh - 62px); overflow-y: auto;
        }
        .sidebar-section { padding: 0 10px; margin-bottom: 22px; }
        .sidebar-lbl {
          font-size: 9.5px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;
          color: #444; padding: 0 12px; margin-bottom: 5px;
        }
        .sidebar-item {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 12px; border-radius: 10px; cursor: pointer;
          transition: all 0.14s; color: #888; font-size: 13.5px; font-weight: 500;
          margin-bottom: 2px; border: 1px solid transparent;
        }
        .sidebar-item:hover { background: #212121; color: #F2F2F2; }
        .sidebar-item.active { background: rgba(255,209,0,0.09); border-color: rgba(255,209,0,0.18); color: #FFD100; font-weight: 700; }
        .sidebar-item .s-icon { font-size: 15px; width: 20px; text-align: center; }
        .sidebar-badge {
          margin-right: auto; padding: 2px 8px;
          background: #FFD100; color: #0E0E0E;
          border-radius: 50px; font-size: 10px; font-weight: 900;
        }
        .admin-main { flex: 1; padding: 26px; min-width: 0; overflow-x: hidden; }
        .admin-page-title {
          font-size: 28px; font-weight: 900; color: #F2F2F2;
          margin-bottom: 22px; letter-spacing: -0.5px;
        }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px; }
        .stat-card {
          background: #191919; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 20px; transition: all 0.18s; cursor: default;
        }
        .stat-card:hover { border-color: rgba(255,209,0,0.18); transform: translateY(-2px); }
        .stat-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; margin-bottom: 12px;
        }
        .stat-icon.y { background: rgba(255,209,0,0.09); border: 1px solid rgba(255,209,0,0.18); }
        .stat-icon.g { background: rgba(39,174,96,0.1); border: 1px solid rgba(39,174,96,0.2); }
        .stat-icon.b { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); }
        .stat-icon.r { background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.2); }
        .stat-num { font-size: 36px; font-weight: 900; color: #F2F2F2; line-height: 1; margin-bottom: 4px; }
        .stat-label { font-size: 12px; color: #888; font-weight: 500; }
        .table-card {
          background: #191919; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; overflow: hidden; margin-bottom: 22px;
        }
        .table-hdr {
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255,255,255,0.01);
        }
        .table-title { font-size: 15px; font-weight: 800; color: #F2F2F2; display: flex; align-items: center; gap: 8px; }
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th {
          text-align: right; padding: 10px 18px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase;
          color: #444; border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.01);
        }
        .tbl td {
          padding: 14px 18px; font-size: 13px; color: #F2F2F2;
          border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle;
        }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tr:hover td { background: rgba(255,255,255,0.02); }
        .customer-name { font-weight: 800; font-size: 14px; }
        .customer-phone { font-size: 12px; color: #888; margin-top: 2px; direction: ltr; text-align: right; }
        .price-cell { font-size: 17px; font-weight: 900; color: #FFD100; }
        .badge-pill {
          display: inline-flex; align-items: center;
          padding: 2px 10px; border-radius: 50px;
          font-size: 11px; font-weight: 800;
        }
        .badge-pending { background: rgba(255,209,0,0.09); color: #FFD100; border: 1px solid rgba(255,209,0,0.18); }
        .badge-approved { background: rgba(39,174,96,0.1); color: #27AE60; border: 1px solid rgba(39,174,96,0.2); }
        .badge-claimed { background: rgba(59,130,246,0.1); color: #60A5FA; border: 1px solid rgba(59,130,246,0.2); }
        .badge-rejected { background: rgba(231,76,60,0.1); color: #E74C3C; border: 1px solid rgba(231,76,60,0.2); }
        .badge-completed { background: rgba(107,114,128,0.1); color: #9CA3AF; border: 1px solid rgba(107,114,128,0.2); }
        .action-btns { display: flex; gap: 6px; }
        .btn-approve {
          padding: 5px 14px; background: rgba(39,174,96,0.12);
          border: 1px solid rgba(39,174,96,0.25); color: #27AE60;
          border-radius: 8px; font-size: 12px; font-weight: 800;
          cursor: pointer; font-family: 'Heebo', sans-serif; transition: all 0.14s;
        }
        .btn-approve:hover { background: rgba(39,174,96,0.22); }
        .btn-reject {
          padding: 5px 14px; background: rgba(231,76,60,0.1);
          border: 1px solid rgba(231,76,60,0.22); color: #E74C3C;
          border-radius: 8px; font-size: 12px; font-weight: 800;
          cursor: pointer; font-family: 'Heebo', sans-serif; transition: all 0.14s;
        }
        .btn-reject:hover { background: rgba(231,76,60,0.2); }
        .btn-complete {
          padding: 5px 14px; background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.2); color: #60A5FA;
          border-radius: 8px; font-size: 12px; font-weight: 800;
          cursor: pointer; font-family: 'Heebo', sans-serif; transition: all 0.14s;
        }
        .driver-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 0.13s;
        }
        .driver-row:hover { background: rgba(255,255,255,0.02); }
        .driver-row:last-of-type { border-bottom: none; }
        .driver-av {
          width: 38px; height: 38px; background: #212121; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: #FFD100; flex-shrink: 0;
        }
        .driver-av.inactive { color: #444; }
        .driver-name { font-weight: 700; font-size: 14px; color: #F2F2F2; }
        .driver-meta { font-size: 12px; color: #888; margin-top: 1px; }
        .driver-credit-val { font-size: 18px; font-weight: 700; color: #FFD100; }
        .driver-credit-lbl { font-size: 10px; color: #444; display: block; }
        .mini-toggle {
          width: 38px; height: 22px; background: #444; border-radius: 50px;
          position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0;
          border: none; padding: 0;
        }
        .mini-toggle.on { background: #27AE60; }
        .mini-toggle::after {
          content: ''; position: absolute; top: 2px; right: 2px;
          width: 18px; height: 18px; background: white;
          border-radius: 50%; transition: transform 0.2s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .mini-toggle.on::after { transform: translateX(-16px); }
        .credit-form {
          padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; gap: 10px; align-items: flex-end;
          background: rgba(255,209,0,0.02);
        }
        .credit-form .cf-field { flex: 1; }
        .credit-form label { color: #444; font-size: 10.5px; display: block; margin-bottom: 5px; }
        .credit-form input, .credit-form select {
          height: 40px; padding: 0 13px; font-size: 13px;
          background: #212121; color: #F2F2F2;
          border: 1px solid rgba(255,255,255,0.07); border-radius: 8px;
          width: 100%; font-family: 'Heebo', sans-serif; direction: rtl;
        }
        .credit-form input:focus, .credit-form select:focus {
          outline: none; border-color: #FFD100;
        }
        .credit-form select option { background: #212121; }
        .btn-load {
          padding: 0 20px; height: 40px; background: #FFD100; color: #0E0E0E;
          border: none; border-radius: 10px; font-family: 'Heebo', sans-serif;
          font-size: 13px; font-weight: 900; cursor: pointer; transition: all 0.15s;
          white-space: nowrap; flex-shrink: 0;
        }
        .btn-load:hover { background: #FFE040; }
        .btn-load:disabled { opacity: 0.5; cursor: not-allowed; }
        .filter-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-btn {
          background: #191919; color: #888; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 6px 14px; cursor: pointer;
          font-size: 13px; font-weight: 600; font-family: 'Heebo', sans-serif;
          transition: all 0.15s;
        }
        .filter-btn.active { background: #FFD100; color: #0E0E0E; border-color: #FFD100; }
        .toast-ok {
          background: rgba(39,174,96,0.1); border: 1px solid rgba(39,174,96,0.3);
          color: #27AE60; border-radius: 10px; padding: 10px 16px;
          font-size: 14px; font-weight: 600; margin-bottom: 20px;
        }
        .toast-err {
          background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.3);
          color: #E74C3C; border-radius: 10px; padding: 10px 16px;
          font-size: 14px; font-weight: 600; margin-bottom: 20px;
        }
        .bottom-nav {
          display: none;
          position: fixed; bottom: 0; right: 0; left: 0; z-index: 200;
          background: rgba(14,14,14,0.97); backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 6px 0 env(safe-area-inset-bottom, 6px);
        }
        .bottom-nav-inner {
          display: flex; justify-content: space-around; align-items: center;
        }
        .bottom-nav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 6px 16px; border: none; background: none; cursor: pointer;
          color: #555; transition: color 0.15s; font-family: 'Heebo', sans-serif;
          position: relative; min-width: 60px;
        }
        .bottom-nav-btn.active { color: #FFD100; }
        .bottom-nav-btn .nav-icon { font-size: 20px; line-height: 1; }
        .bottom-nav-btn .nav-label { font-size: 10px; font-weight: 700; }
        .bottom-nav-btn .nav-badge {
          position: absolute; top: 2px; right: 8px;
          background: #FFD100; color: #0E0E0E;
          font-size: 9px; font-weight: 900;
          width: 16px; height: 16px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .stat-card { cursor: pointer; }
        @media (max-width: 768px) {
          .admin-sidebar { display: none; }
          .bottom-nav { display: block; }
          .admin-main { padding: 16px 14px 90px; }
          .stats-row { grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
          .stat-card { padding: 14px; }
          .stat-num { font-size: 28px !important; }
          .admin-page-title { font-size: 22px; margin-bottom: 16px; }
          .credit-form { flex-wrap: wrap; }
          .tbl th, .tbl td { padding: 10px 10px; font-size: 12px; }
          .table-card { overflow-x: auto; }
        }
      `}</style>

      <div className="admin-wrap">
        {/* Header */}
        <header className="admin-header">
          <button onClick={() => router.refresh()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, height: 62, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            <Image src="/sababa_logo.png" alt="מוניות סבבה" width={200} height={200} style={{ height: 145, width: 'auto', marginTop: -41, marginBottom: -41 }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#888' }}>מנהל ראשי</span>
            <button className="btn-ghost-sm btn-ghost-red" onClick={handleLogout}>התנתק</button>
          </div>
        </header>

        <div className="admin-layout">
          {/* Sidebar */}
          <aside className="admin-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-lbl">ניהול</div>
              {sidebarItems.map(item => (
                <div
                  key={item.key}
                  className={`sidebar-item${tab === item.key ? ' active' : ''}`}
                  onClick={() => setTab(item.key)}
                >
                  <span className="s-icon">{item.icon}</span>
                  {item.label}
                  {item.badge ? <span className="sidebar-badge">{item.badge}</span> : null}
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <main className="admin-main">
            {actionMsg && (
              <div className={actionMsg.type === 'ok' ? 'toast-ok' : 'toast-err'}>
                {actionMsg.text}
              </div>
            )}

            {/* ── Dashboard ── */}
            {tab === 'dashboard' && (
              <>
                <div className="admin-page-title">דשבורד ניהול</div>
                <div className="stats-row">
                  <div className="stat-card" onClick={() => { setStatusFilter('pending'); setTab('bookings') }}>
                    <div className="stat-icon y">⏳</div>
                    <div className="stat-num" style={{ color: '#FFD100' }}>{pendingCount}</div>
                    <div className="stat-label">הזמנות ממתינות</div>
                  </div>
                  <div className="stat-card" onClick={() => setTab('drivers')}>
                    <div className="stat-icon g">🚕</div>
                    <div className="stat-num">{activeDrivers}</div>
                    <div className="stat-label">נהגים פעילים</div>
                  </div>
                  <div className="stat-card" onClick={() => { setStatusFilter('all'); setTab('bookings') }}>
                    <div className="stat-icon b">✅</div>
                    <div className="stat-num">{todayRides}</div>
                    <div className="stat-label">נסיעות היום</div>
                  </div>
                  <div className="stat-card" onClick={() => { setStatusFilter('all'); setTab('bookings') }}>
                    <div className="stat-icon r">💰</div>
                    <div className="stat-num" style={{ fontSize: monthRevenue > 9999 ? 26 : 36 }}>
                      {monthRevenue.toLocaleString('he-IL')}
                    </div>
                    <div className="stat-label">הכנסות החודש (₪)</div>
                  </div>
                </div>

                {/* Pending bookings preview */}
                {pendingCount > 0 && (
                  <div className="table-card">
                    <div className="table-hdr">
                      <div className="table-title">
                        הזמנות ממתינות לאישור
                        <span className="badge-pill badge-pending">{pendingCount} ממתינות</span>
                      </div>
                      <button className="btn-ghost-sm" onClick={() => setTab('bookings')}>ראה הכל</button>
                    </div>
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {bookings.filter(b => b.status === 'pending').slice(0, 5).map(b => (
                        <BookingCard
                          key={b.id} booking={b}
                          expanded={expandedBooking === b.id}
                          onToggle={() => setExpandedBooking(expandedBooking === b.id ? null : b.id)}
                          onApprove={() => updateBookingStatus(b.id, 'approved')}
                          onReject={() => updateBookingStatus(b.id, 'rejected')}
                          onComplete={() => updateBookingStatus(b.id, 'completed')}
                          drivers={drivers}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Bookings ── */}
            {tab === 'bookings' && (
              <>
                <div className="admin-page-title">הזמנות</div>
                <div className="filter-row">
                  {[['all','הכל'],['pending','ממתינים'],['approved','מאושרים'],['claimed','שורינו'],['completed','הושלמו'],['rejected','נדחו']].map(([val, label]) => (
                    <button key={val} className={`filter-btn${statusFilter === val ? ' active' : ''}`} onClick={() => setStatusFilter(val)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="table-card">
                  <div className="table-hdr">
                    <div className="table-title">
                      רשימת הזמנות
                      <span className="badge-pill badge-pending">{filteredBookings.length}</span>
                    </div>
                  </div>
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredBookings.map(b => (
                      <BookingCard
                        key={b.id} booking={b}
                        expanded={expandedBooking === b.id}
                        onToggle={() => setExpandedBooking(expandedBooking === b.id ? null : b.id)}
                        onApprove={() => updateBookingStatus(b.id, 'approved')}
                        onReject={() => updateBookingStatus(b.id, 'rejected')}
                        onComplete={() => updateBookingStatus(b.id, 'completed')}
                        drivers={drivers}
                      />
                    ))}
                    {filteredBookings.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: '#444' }}>אין הזמנות להצגה</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Drivers ── */}
            {tab === 'drivers' && (
              <>
                <div className="admin-page-title">ניהול נהגים</div>

                {/* New driver form */}
                <div className="table-card" style={{ marginBottom: 22 }}>
                  <div className="table-hdr">
                    <div className="table-title">➕ הוספת נהג חדש</div>
                    <button
                      className="btn-ghost-sm"
                      onClick={() => setShowNewDriverForm(v => !v)}
                    >
                      {showNewDriverForm ? 'סגור' : 'פתח טופס'}
                    </button>
                  </div>
                  {showNewDriverForm && (
                    <div style={{ padding: '20px', display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>שם מלא *</label>
                        <input
                          type="text" placeholder="דוד כהן"
                          value={newDriver.full_name}
                          onChange={e => setNewDriver(p => ({ ...p, full_name: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif', direction: 'rtl' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>טלפון *</label>
                        <input
                          type="tel" placeholder="050-0000000"
                          value={newDriver.phone}
                          onChange={e => setNewDriver(p => ({ ...p, phone: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif', direction: 'ltr', textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>אימייל *</label>
                        <input
                          type="email" placeholder="driver@email.com"
                          value={newDriver.email}
                          onChange={e => setNewDriver(p => ({ ...p, email: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif', direction: 'ltr' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>סיסמה *</label>
                        <input
                          type="password" placeholder="לפחות 6 תווים"
                          value={newDriver.password}
                          onChange={e => setNewDriver(p => ({ ...p, password: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif', direction: 'ltr' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>סוג רכב</label>
                        <select
                          value={newDriver.vehicle_type}
                          onChange={e => setNewDriver(p => ({ ...p, vehicle_type: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif' }}
                        >
                          <option value="regular">מונית רגילה</option>
                          <option value="minivan">ואן / מיניבוס</option>
                          <option value="luxury">יוקרה</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>מספר רכב</label>
                        <input
                          type="text" placeholder="12-345-67"
                          value={newDriver.vehicle_number}
                          onChange={e => setNewDriver(p => ({ ...p, vehicle_number: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif', direction: 'ltr' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>דגם רכב</label>
                        <input
                          type="text" placeholder="טויוטה קורולה"
                          value={newDriver.vehicle_model}
                          onChange={e => setNewDriver(p => ({ ...p, vehicle_model: e.target.value }))}
                          style={{ height: 40, padding: '0 13px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, width: '100%', fontFamily: 'Heebo, sans-serif' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                          className="btn-load"
                          style={{ width: '100%' }}
                          onClick={createDriver}
                          disabled={creatingDriver}
                        >
                          {creatingDriver ? 'יוצר...' : '✓ צור נהג'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="table-card">
                  <div className="table-hdr">
                    <div className="table-title">
                      נהגים
                      <span className="badge-pill badge-approved">{activeDrivers} פעילים</span>
                    </div>
                  </div>
                  {drivers.map(d => (
                    <div key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="driver-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className={`driver-av${!d.is_active ? ' inactive' : ''}`}>{d.full_name[0]}</div>
                          <div>
                            <div className="driver-name">{d.full_name}</div>
                            <div className="driver-meta">
                              {d.vehicle_type} • {d.vehicle_model ?? ''}{d.vehicle_model && d.vehicle_number ? ' ' : ''}{d.vehicle_number ?? 'אין מספר רכב'} • {d.phone}
                              {d.subscription_expires_at && (
                                <span> • פג: {new Date(d.subscription_expires_at).toLocaleDateString('he-IL')}</span>
                              )}
                              {!d.subscription_active && <span style={{ color: '#E74C3C' }}> • מנוי לא פעיל</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            className="btn-ghost-sm"
                            onClick={() => {
                              setEditingDriver(editingDriver === d.id ? null : d.id)
                              setEditDriverData({ vehicle_type: d.vehicle_type, vehicle_number: d.vehicle_number ?? '', vehicle_model: d.vehicle_model ?? '' })
                            }}
                          >✏️ עריכה</button>
                          <div>
                            <span className="driver-credit-val">{d.credits} ₪</span>
                            <span className="driver-credit-lbl">קרדיט</span>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9.5px', color: '#444', marginBottom: 4 }}>מנוי</div>
                            <button
                              className={`mini-toggle${d.subscription_active ? ' on' : ''}`}
                              onClick={() => toggleSubscription(d)}
                              title={d.subscription_active ? 'השבת מנוי' : 'הפעל מנוי'}
                            />
                          </div>
                        </div>
                      </div>
                      {editingDriver === d.id && (
                        <div style={{ padding: '12px 20px 16px', background: '#141414', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div>
                            <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>סוג רכב</label>
                            <select
                              value={editDriverData.vehicle_type}
                              onChange={e => setEditDriverData(p => ({ ...p, vehicle_type: e.target.value }))}
                              style={{ height: 36, padding: '0 10px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, fontFamily: 'Heebo, sans-serif' }}
                            >
                              <option value="regular">מונית רגילה</option>
                              <option value="minivan">ואן / מיניבוס</option>
                              <option value="luxury">יוקרה</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>מספר רכב</label>
                            <input
                              type="text" placeholder="12-345-67"
                              value={editDriverData.vehicle_number}
                              onChange={e => setEditDriverData(p => ({ ...p, vehicle_number: e.target.value }))}
                              style={{ height: 36, padding: '0 10px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, width: 120, fontFamily: 'Heebo, sans-serif', direction: 'ltr' }}
                            />
                          </div>
                          <div>
                            <label style={{ color: '#444', fontSize: '10.5px', display: 'block', marginBottom: 5 }}>דגם רכב</label>
                            <input
                              type="text" placeholder="טויוטה קורולה"
                              value={editDriverData.vehicle_model}
                              onChange={e => setEditDriverData(p => ({ ...p, vehicle_model: e.target.value }))}
                              style={{ height: 36, padding: '0 10px', fontSize: 13, background: '#212121', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, width: 140, fontFamily: 'Heebo, sans-serif' }}
                            />
                          </div>
                          <button className="btn-approve" onClick={() => saveDriverEdit(d.id)}>שמור</button>
                          <button className="btn-ghost-sm" onClick={() => setEditingDriver(null)}>ביטול</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {drivers.length === 0 && (
                    <div style={{ padding: '30px 20px', textAlign: 'center', color: '#444' }}>
                      אין נהגים. צור נהגים דרך Supabase Authentication ואז הוסף לטבלת drivers.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Revenue ── */}
            {tab === 'revenue' && (
              <>
                <div className="admin-page-title">רווחים</div>
                {!revenue && !loadingRevenue && (
                  <button className="btn-load" onClick={loadRevenue}>טען נתוני רווחים</button>
                )}
                {loadingRevenue && <div style={{ color: '#888', padding: 20 }}>טוען...</div>}
                {revenue && (
                  <div className="stats-row">
                    <div className="stat-card">
                      <div className="stat-icon g">🪙</div>
                      <div className="stat-num" style={{ color: '#FFD100' }}>₪{revenue.subscriptions.toLocaleString('he-IL')}</div>
                      <div className="stat-label">הכנסות מנויים החודש</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>300₪ לכל הפעלת מנוי</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon b">💳</div>
                      <div className="stat-num" style={{ color: '#3B82F6' }}>₪{revenue.credits.toLocaleString('he-IL')}</div>
                      <div className="stat-label">קרדיטים שנטענו החודש</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>סך טעינות אדמין</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon r">🚕</div>
                      <div className="stat-num" style={{ color: '#27AE60' }}>₪{revenue.rides.toLocaleString('he-IL')}</div>
                      <div className="stat-label">שווי נסיעות שבוצעו</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>נסיעות שזמנן עבר</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon y">📊</div>
                      <div className="stat-num">₪{(revenue.subscriptions + revenue.credits).toLocaleString('he-IL')}</div>
                      <div className="stat-label">סה״כ כסף שנכנס החודש</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>מנויים + קרדיטים</div>
                    </div>
                  </div>
                )}
                {revenue && (
                  <button className="btn-ghost-sm" style={{ marginTop: 8 }} onClick={loadRevenue}>
                    🔄 רענן נתונים
                  </button>
                )}
              </>
            )}

            {/* ── History ── */}
            {tab === 'history' && (() => {
              const historyBookings = bookings.filter(b => {
                if (!['claimed', 'completed', 'cancelled', 'rejected'].includes(b.status)) return false
                if (b.status === 'claimed' || b.status === 'completed') {
                  const rideTime = new Date(`${b.travel_date}T${b.travel_time}`)
                  return rideTime <= new Date()
                }
                return true
              }).sort((a, b) => new Date(`${b.travel_date}T${b.travel_time}`).getTime() - new Date(`${a.travel_date}T${a.travel_time}`).getTime())
              return (
                <>
                  <div className="admin-page-title">היסטוריית נסיעות</div>
                  <div className="table-card">
                    <div className="table-hdr">
                      <div className="table-title">כל הנסיעות שבוצעו / בוטלו / נדחו</div>
                      <div style={{ color: '#666', fontSize: 13 }}>{historyBookings.length} נסיעות</div>
                    </div>
                    {historyBookings.length === 0 ? (
                      <div style={{ padding: '30px 20px', textAlign: 'center', color: '#444' }}>אין היסטוריה עדיין</div>
                    ) : (
                      historyBookings.map(b => {
                        const driver = b.driver_id ? drivers.find(d => d.id === b.driver_id) : null
                        return (
                          <div key={b.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{b.customer_name}</div>
                              <div style={{ fontSize: 13, color: '#666' }}>{b.pickup_city} • {b.travel_date} {b.travel_time?.slice(0,5)}</div>
                              {driver && <div style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>נהג: {driver.full_name}</div>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontWeight: 800, fontSize: 16, color: '#FFD100' }}>₪{b.price}</span>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                                background: b.status === 'completed' ? 'rgba(39,174,96,0.15)' : b.status === 'claimed' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
                                color: b.status === 'completed' ? '#27AE60' : b.status === 'claimed' ? '#3B82F6' : '#6B7280',
                              }}>
                                {STATUS_LABELS[b.status] ?? b.status}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )
            })()}

            {/* ── Credits ── */}
            {tab === 'credits' && (
              <>
                <div className="admin-page-title">ניהול קרדיט</div>
                <div className="table-card">
                  <div className="table-hdr">
                    <div className="table-title">יתרות קרדיט</div>
                  </div>
                  {drivers.map(d => (
                    <div key={d.id} className="driver-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="driver-av">{d.full_name[0]}</div>
                        <div>
                          <div className="driver-name">{d.full_name}</div>
                          <div className="driver-meta">{d.phone}</div>
                        </div>
                      </div>
                      <div>
                        <span className="driver-credit-val">{d.credits} ₪</span>
                        <span className="driver-credit-lbl">קרדיט</span>
                      </div>
                    </div>
                  ))}

                  {/* Credit load form */}
                  <div className="credit-form">
                    <div className="cf-field">
                      <label>נהג לטעינת קרדיט</label>
                      <select value={creditInputs.driverId} onChange={e => setCreditInputs(p => ({ ...p, driverId: e.target.value }))}>
                        <option value="">— בחר נהג —</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.full_name} (₪{d.credits})</option>
                        ))}
                      </select>
                    </div>
                    <div className="cf-field">
                      <label>סכום (₪)</label>
                      <input
                        type="number" min="1" placeholder="200"
                        value={creditInputs.amount}
                        onChange={e => setCreditInputs(p => ({ ...p, amount: e.target.value }))}
                      />
                    </div>
                    <div className="cf-field">
                      <label>הערה</label>
                      <input
                        type="text" placeholder="תשלום מזומן אפריל"
                        value={creditInputs.notes}
                        onChange={e => setCreditInputs(p => ({ ...p, notes: e.target.value }))}
                      />
                    </div>
                    <button className="btn-load" onClick={loadCredit} disabled={loadingCredit}>
                      {loadingCredit ? '...' : '+ טען קרדיט'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Leads ── */}
            {tab === 'leads' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>🎯 לידים שלא השלימו הזמנה</div>
                  <div style={{ color: 'var(--txt2)', fontSize: 13 }}>{leads.length} לידים</div>
                </div>
                {leads.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--txt2)' }}>אין לידים פתוחים כרגע 🎉</div>
                ) : (
                  <div style={{ display: 'grid', gap: 0 }}>
                    {leads.map((lead, i) => (
                      <div key={lead.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderBottom: i < leads.length - 1 ? '1px solid var(--border)' : 'none',
                        gap: 12,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>{lead.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>
                            {new Date(lead.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {lead.email && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>{lead.email}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <a href={`tel:${lead.phone}`} style={{
                            background: 'var(--y)', color: '#000', fontWeight: 700,
                            padding: '8px 14px', borderRadius: 8, fontSize: 14,
                            textDecoration: 'none', whiteSpace: 'nowrap',
                          }}>
                            📞 {lead.phone}
                          </a>
                          {lead.phone && (
                            <a href={`https://wa.me/972${lead.phone.replace(/\D/g, '').replace(/^0/, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{
                                background: '#25D366', color: '#fff', fontWeight: 700,
                                padding: '8px 12px', borderRadius: 8, fontSize: 14,
                                textDecoration: 'none',
                              }}>
                              💬
                            </a>
                          )}
                          <button
                            onClick={async () => {
                              await fetch('/api/leads', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phone: lead.phone }),
                              })
                              setLeads(prev => prev.filter(l => l.id !== lead.id))
                            }}
                            style={{
                              background: 'var(--card2)', border: '1px solid var(--border)',
                              color: 'var(--txt2)', padding: '8px 12px', borderRadius: 8,
                              fontSize: 13, cursor: 'pointer',
                            }}
                            title="סמן כטופל"
                          >
                            ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Bottom nav — mobile only */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {([
              ['dashboard', '📊', 'דשבורד', 0],
              ['bookings',  '🗂',  'הזמנות', pendingCount],
              ['drivers',   '👥',  'נהגים',  0],
              ['credits',   '💳',  'קרדיט',  0],
              ['revenue',   '📈',  'רווחים', 0],
              ['history',   '📋',  'היסטוריה', 0],
              ['leads',     '🎯',  'לידים',    leads.length],
            ] as const).map(([key, icon, label, badge]) => (
              <button
                key={key}
                className={`bottom-nav-btn${tab === key ? ' active' : ''}`}
                onClick={() => setTab(key)}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </>
  )
}

// ─── BookingCard ─────────────────────────────────────────────────

const EXTRAS_LABELS: Record<string, string> = {
  additional_stop: 'נקודה נוספת באותו ישוב (+₪20)',
  nearby_city_stop: 'נקודה נוספת בישוב סמוך (+₪40)',
  child_under4: 'ילד עד גיל 4 (+₪10)',
  safety_seat: 'כיסא בטיחות (+₪40–70)',
  ski_equipment: 'ציוד סקי/גלישה (+₪20)',
  bike_rack: 'ארגז אופניים (+₪50)',
}

const STATUS_LABELS_CARD: Record<string, string> = {
  pending: 'ממתין', approved: 'מאושר', claimed: 'שורין',
  completed: 'הושלם', rejected: 'נדחה', cancelled: 'בוטל',
}
const STATUS_COLORS_CARD: Record<string, string> = {
  pending: '#FFD100', approved: '#27AE60', claimed: '#3B82F6',
  completed: '#6B7280', rejected: '#EF4444', cancelled: '#6B7280',
}

function BookingCard({ booking: b, expanded, onToggle, onApprove, onReject, onComplete, drivers }: {
  booking: Booking
  expanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onComplete: () => void
  drivers: Driver[]
}) {
  const extras = (b.extras as Record<string, boolean>) ?? {}
  const activeExtras = Object.entries(extras).filter(([, v]) => v).map(([k]) => EXTRAS_LABELS[k] ?? k)
  const claimedDriver = b.driver_id ? drivers.find(d => d.id === b.driver_id) : null

  return (
    <div style={{
      background: '#191919',
      border: `1px solid ${expanded ? 'rgba(255,209,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Summary row — always visible */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          cursor: 'pointer',
        }}
      >
        {/* Left: customer + city + time */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#F2F2F2' }}>{b.customer_name}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: `${STATUS_COLORS_CARD[b.status]}22`,
              color: STATUS_COLORS_CARD[b.status],
            }}>{STATUS_LABELS_CARD[b.status]}</span>
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>
            {b.pickup_city} → בן גוריון &nbsp;•&nbsp; {b.travel_date} &nbsp;<strong style={{ color: '#aaa' }}>{b.travel_time?.slice(0, 5)}</strong>
            &nbsp;•&nbsp; {b.passengers} נוסעים
          </div>
          {claimedDriver && (
            <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                🚕 {claimedDriver.full_name}
              </span>
              <span style={{ fontSize: 11, color: '#555', direction: 'ltr' }}>{claimedDriver.phone}</span>
            </div>
          )}
        </div>

        {/* Price */}
        <div style={{ textAlign: 'center', minWidth: 64 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#FFD100' }}>₪{b.price}</div>
        </div>

        {/* Expand arrow */}
        <div style={{ color: '#555', fontSize: 14, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
        {b.status === 'pending' && <>
          <button className="btn-approve" onClick={onApprove}>✓ אשר</button>
          <button className="btn-reject" onClick={onReject}>✗ דחה</button>
        </>}
        {b.status === 'approved' && <button className="btn-reject" onClick={onReject}>בטל</button>}
        {b.status === 'claimed' && <button className="btn-complete" onClick={onComplete}>✓ סיים נסיעה</button>}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          background: '#141414',
        }}>
          <Detail label="טלפון" value={b.customer_phone} />
          {b.customer_email && <Detail label="אימייל" value={b.customer_email} />}
          <Detail label="כתובת איסוף" value={`${b.pickup_street} ${b.pickup_house_number}, ${b.pickup_city}`} />
          <Detail label="תאריך ושעה" value={`${b.travel_date} • ${b.travel_time?.slice(0,5)}`} />
          <Detail label="נוסעים" value={String(b.passengers)} />
          {(b.large_luggage ?? 0) > 0 && <Detail label="מזוודות גדולות" value={String(b.large_luggage)} />}
          {(b.trolley ?? 0) > 0 && <Detail label="טרולי" value={String(b.trolley)} />}
          <Detail label="תשלום" value={b.payment_method === 'bit' ? 'ביט' : 'מזומן'} />
          {b.return_trip && (
            <>
              <Detail label="חזרה מהשדה" value="כן" highlight />
              {b.return_address && <Detail label="כתובת חזרה" value={b.return_address} />}
              {b.return_flight_number && <Detail label="מספר טיסה" value={b.return_flight_number} />}
              {b.return_date && <Detail label="תאריך חזרה" value={`${b.return_date}${b.return_time ? ' • ' + b.return_time.slice(0,5) : ''}`} />}
            </>
          )}
          {activeExtras.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>תוספות</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeExtras.map(e => (
                  <span key={e} style={{ background: 'rgba(255,209,0,0.1)', color: '#FFD100', fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>{e}</span>
                ))}
              </div>
            </div>
          )}
          {b.special_requests && (
            <div style={{ gridColumn: '1 / -1' }}>
              <Detail label="הערות מיוחדות" value={b.special_requests} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? '#FFD100' : '#C0C0C0' }}>{value}</div>
    </div>
  )
}
