export interface ScreenshotProtectionStatus {
  isProtected: boolean;
  platform: string;
  nativeProtectionAvailable: boolean;
  protectedWindowsCount: number;
}

export interface ScreenshotProtectionConfig {
  enableNativeProtection: boolean;
  enableContentProtection: boolean;
  enableMacOSFeatures: boolean;
  enableWindowsFeatures: boolean;
}
