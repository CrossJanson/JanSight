import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.JanSightMultiPic',
  appName: 'JanSightMultiPic',
  webDir: 'www',
  plugins: {
    LiveUpdates: {
      appId: 'dd14d543',
      channel: 'Production',
      autoUpdateMethod: 'background',
      maxVersions: 3
    }
  }
};

export default config;
