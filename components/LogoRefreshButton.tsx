'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function LogoRefreshButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.refresh()}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, height: 60, overflow: 'hidden', display: 'flex', alignItems: 'center' }}
    >
      <Image
        src="/sababa_logo.png"
        alt="מוניות סבבה"
        width={200}
        height={200}
        style={{ height: 140, width: 'auto', marginTop: -40, marginBottom: -40 }}
        priority
      />
    </button>
  )
}
