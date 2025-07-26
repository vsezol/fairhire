import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
});

declare global {
  interface Window {
    electronAPI: {
      openUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
