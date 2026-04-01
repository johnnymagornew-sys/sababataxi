import dynamic from 'next/dynamic'

const DashboardWrapper = dynamic(() => import('./DashboardWrapper'), { ssr: false })

export default function DriverDashboardPage() {
  return <DashboardWrapper />
}
