import { contextBridge, ipcRenderer } from 'electron';

export type KeyDownEvent = {
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
};

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url: string) => {
    return ipcRenderer.invoke('open-url', url);
  },

  activityTracker: {
    mouseClick: (x: number, y: number, button?: string) =>
      ipcRenderer.invoke('activity-tracker:mouse-click', x, y, button),
    keyDown: (event: KeyDownEvent) =>
      ipcRenderer.invoke('activity-tracker:key-down', event),
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
        keyDown: (
          event: KeyDownEvent
        ) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}
