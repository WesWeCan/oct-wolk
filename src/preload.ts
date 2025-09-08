// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import * as StorageTypes from '@/types/storage_types';
import type { TimelineDocument, SceneDocumentBase } from '@/types/timeline_types';

declare global {
    interface Window {
        electronAPI: {
            getRandomNumber: () => Promise<number>;
            openMainWindow: () => void;
            openExternal: (url: string) => void;
            openStorageFolder: () => void;
            // Event methods
            songs: {
                create: (initial?: any) => Promise<any>;
                save: (song: any) => Promise<any>;
                load: (songId: string) => Promise<any>;
                list: () => Promise<any[]>;
                uploadCover: (songId: string, fileData: ArrayBuffer, originalFileName: string) => Promise<any>;
                uploadAudio: (songId: string, fileData: ArrayBuffer, originalFileName: string) => Promise<any>;
            };
            timeline: {
                createOrLoad: (songId: string) => Promise<TimelineDocument>;
                save: (songId: string, timeline: TimelineDocument) => Promise<TimelineDocument>;
                listScenes: (songId: string) => Promise<string[]>;
                saveScene: (songId: string, scene: SceneDocumentBase) => Promise<SceneDocumentBase>;
                loadScene: (songId: string, sceneId: string) => Promise<SceneDocumentBase | null>;
            },
            fonts: {
                list: () => Promise<{ familyGuess: string; filePath: string; fileName: string; }[]>;
            }
        };
    }
}

// Send renderer-ready signal when preload script loads
ipcRenderer.send('renderer-ready');

contextBridge.exposeInMainWorld('electronAPI', {
    getRandomNumber: () => ipcRenderer.invoke('getRandomNumber'),
    openStorageFolder: () => ipcRenderer.invoke('open-storage-folder'),
    songs: {
        create: (initial?: any) => ipcRenderer.invoke('songs:create', initial),
        save: (song: any) => ipcRenderer.invoke('songs:save', song),
        load: (songId: string) => ipcRenderer.invoke('songs:load', songId),
        list: () => ipcRenderer.invoke('songs:list'),
        uploadCover: (songId: string, fileData: ArrayBuffer, originalFileName: string) => ipcRenderer.invoke('songs:uploadCover', songId, fileData, originalFileName),
        uploadAudio: (songId: string, fileData: ArrayBuffer, originalFileName: string) => ipcRenderer.invoke('songs:uploadAudio', songId, fileData, originalFileName),
    },
    timeline: {
        createOrLoad: (songId: string) => ipcRenderer.invoke('timeline:createOrLoad', songId),
        save: (songId: string, timeline: TimelineDocument) => ipcRenderer.invoke('timeline:save', songId, timeline),
        listScenes: (songId: string) => ipcRenderer.invoke('timeline:listScenes', songId),
        saveScene: (songId: string, scene: SceneDocumentBase) => ipcRenderer.invoke('timeline:saveScene', songId, scene),
        loadScene: (songId: string, sceneId: string) => ipcRenderer.invoke('timeline:loadScene', songId, sceneId),
    },
    fonts: {
        list: () => ipcRenderer.invoke('fonts:list'),
    },

    // Event methods
    on(channel: string, callback: (...args: any[]) => void) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    removeAllListeners(channel: string) {
        ipcRenderer.removeAllListeners(channel);
    }
});