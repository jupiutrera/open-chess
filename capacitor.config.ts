import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.openchess.app',
  appName: 'Open Chess',
  webDir: 'dist',
  backgroundColor: '#302e2b',
  plugins: {
    SplashScreen: { launchAutoHide: true, backgroundColor: '#302e2b', showSpinner: false },
  },
}

export default config
