import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminRow } = await supabase.from('admins').select('id').eq('user_id', user.id).single()
  if (!adminRow) redirect('/login')

  // Auto-expire subscriptions
  const now = new Date().toISOString()
  await supabase
    .from('drivers')
    .update({ subscription_active: false, subscription_expires_at: null })
    .eq('subscription_active', true)
    .lt('subscription_expires_at', now)

  // Load initial data
  const [bookingsRes, driversRes, leadsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('drivers')
      .select('*')
      .order('full_name'),
    supabase
      .from('leads')
      .select('*')
      .eq('converted', false)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <AdminDashboardClient
      initialBookings={bookingsRes.data ?? []}
      initialDrivers={driversRes.data ?? []}
      initialLeads={leadsRes.data ?? []}
    />
  )
}
