import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://sababataxi.vercel.app'),
  title: 'מוניות סבבה – מוניות לנתב״ג ומעיר לעיר',
  description: 'מוניות לנתב״ג ומעיר לעיר במחירים קבועים מראש. ללא פרטי אשראי, תשלום ישירות לנהג. נהגים מקצועיים, הגעה בזמן, שירות אמין ואדיב.',
  icons: {
    icon: '/sababa_logo.png',
    apple: '/sababa_logo.png',
  },
  openGraph: {
    title: 'מוניות סבבה – מוניות לנתב״ג ומעיר לעיר',
    description: 'מחיר קבוע מראש • ללא פרטי אשראי • נהגים מקצועיים • הגעה בזמן',
    url: 'https://sababataxi.vercel.app',
    siteName: 'מוניות סבבה',
    images: [{ url: '/sababa_logo.png', width: 512, height: 512, alt: 'מוניות סבבה' }],
    locale: 'he_IL',
    type: 'website',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const isRtl = locale === 'he' || locale === 'ar'

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} className={heebo.className}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
