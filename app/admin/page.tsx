import dynamic from 'next/dynamic'

const AdminWrapper = dynamic(() => import('./AdminWrapper'), { ssr: false })

export default function AdminPage() {
  return <AdminWrapper />
}
