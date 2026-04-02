import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const validLocales = ['he', 'en', 'ru', 'ar'] as const
export type Locale = typeof validLocales[number]

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value ?? 'he'
  const locale = (validLocales as readonly string[]).includes(raw) ? raw : 'he'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
