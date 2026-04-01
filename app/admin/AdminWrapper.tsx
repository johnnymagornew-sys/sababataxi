'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Booking, Driver } from '@/types/database'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

type Lead = { id: string; name: string; phone: string; email: string | null; created_at: string; converted: boolean }

export default function AdminWrapper() {
  const [data, setData] = useState<{ bookings: Booking[]; drivers: Driver[]; leads: Lead[] } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function init() {
      // getSession() reads from local storage — no network call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: adminRow } = await supabase
        .from('admins').select('id').eq('user_id', session.user.id).single()
      if (!adminRow) { router.replace('/login'); return }

      // Auto-expire subscriptions
      await supabase
        .from('drivers')
        .update({ subscription_active: false, subscription_expires_at: null })
        .eq('subscription_active', true)
        .lt('subscription_expires_at', new Date().toISOString())

      const [bookingsRes, driversRes, leadsRes] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('drivers').select('*').order('full_name'),
        supabase.from('leads').select('*').eq('converted', false).order('created_at', { ascending: false }).limit(200),
      ])

      setData({
        bookings: bookingsRes.data ?? [],
        drivers: driversRes.data ?? [],
        leads: leadsRes.data ?? [],
      })
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--txt2)', fontSize: 15 }}>טוען...</div>
      </div>
    )
  }

  return (
    <AdminDashboardClient
      initialBookings={data.bookings}
      initialDrivers={data.drivers}
      initialLeads={data.leads}
    />
  )
}
