import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url: string) => {
    return ipcRenderer.invoke('open-url', url);
  },

  activityTracker: {
    mouseClick: (x: number, y: number, button?: string) =>
      ipcRenderer.invoke('activity-tracker:mouse-click', x, y, button),
  },
});

declare global {
  interface Window {
    electronAPI: {
      openUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
      activityTracker: {
        mouseClick: (
          x: number,
          y: number,
          button?: string
        ) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}
