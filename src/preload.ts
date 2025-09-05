// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import * as StorageTypes from '@/types/storage_types';

declare global {
    interface Window {
        electronAPI: {
            getRandomNumber: () => Promise<number>;
            openMainWindow: () => void;
            openExternal: (url: string) => void;
            openStorageFolder: () => void;
            // Event methods
            
        };
    }
}

// Send renderer-ready signal when preload script loads
ipcRenderer.send('renderer-ready');

contextBridge.exposeInMainWorld('electronAPI', {
    getRandomNumber: () => ipcRenderer.invoke('getRandomNumber'),
    openStorageFolder: () => ipcRenderer.invoke('open-storage-folder'),

    // Event methods
    on(channel: string, callback: (...args: any[]) => void) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    removeAllListeners(channel: string) {
        ipcRenderer.removeAllListeners(channel);
    }
});