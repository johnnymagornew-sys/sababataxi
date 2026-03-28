import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DriverDashboardClient from '@/components/driver/DriverDashboardClient'

export default async function DriverDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!driver) redirect('/login')

  // Auto-expire subscription if past expiry date
  if (driver.subscription_active && driver.subscription_expires_at) {
    if (new Date(driver.subscription_expires_at) < new Date()) {
      await supabase
        .from('drivers')
        .update({ subscription_active: false, subscription_expires_at: null })
        .eq('id', driver.id)
      driver.subscription_active = false
      driver.subscription_expires_at = null
    }
  }

  return <DriverDashboardClient driver={driver} />
}
