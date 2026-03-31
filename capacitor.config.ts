import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sababataxi.app',
  appName: 'סבבה טקסי',
  webDir: 'out',
  server: {
    // Points to the live Vercel deployment — mobile app always gets latest version
    url: 'https://sababataxi.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0a0a0a',
  },
  android: {
    backgroundColor: '#0a0a0a',
  },
}

export default config
