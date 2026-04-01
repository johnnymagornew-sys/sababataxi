'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Driver } from '@/types/database'
import DriverDashboardClient from '@/components/driver/DriverDashboardClient'

export default function DashboardWrapper() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [ready, setReady] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function init() {
      // getSession() reads from local storage — no network call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      // One direct Supabase query (no Vercel round-trip)
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (!driverRow) { router.replace('/login'); return }

      // Auto-expire subscription
      if (driverRow.subscription_active && driverRow.subscription_expires_at) {
        if (new Date(driverRow.subscription_expires_at) < new Date()) {
          await supabase
            .from('drivers')
            .update({ subscription_active: false, subscription_expires_at: null })
            .eq('id', driverRow.id)
          driverRow.subscription_active = false
          driverRow.subscription_expires_at = null
        }
      }

      setDriver(driverRow as Driver)
      setReady(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
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

  return <DriverDashboardClient driver={driver!} />
}
