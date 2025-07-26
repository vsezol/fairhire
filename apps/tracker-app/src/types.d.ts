declare global {
  interface Window {
    electronAPI?: {
      openUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};
