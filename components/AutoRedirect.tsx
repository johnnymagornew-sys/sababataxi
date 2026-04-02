'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AutoRedirect() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id
      const { data: adminRow } = await supabase.from('admins').select('id').eq('user_id', userId).single()
      if (adminRow) { router.replace('/admin'); return }

      const { data: driverRow } = await supabase.from('drivers').select('id').eq('user_id', userId).single()
      if (driverRow) { router.replace('/driver/dashboard'); return }
    }
    check()
  }, [])

  return null
}
