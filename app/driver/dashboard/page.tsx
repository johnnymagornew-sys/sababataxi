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

  return <DriverDashboardClient driver={driver} />
}
