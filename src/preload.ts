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
            analysis: {
                loadCache: (songId: string) => Promise<any | null>;
                saveCache: (songId: string, cache: any) => Promise<{ ok: boolean }>;
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
        reset: (songId: string) => ipcRenderer.invoke('project:resetTimeline', songId),
    },
    fonts: {
        list: () => ipcRenderer.invoke('fonts:list'),
    },
    analysis: {
        loadCache: (songId: string) => ipcRenderer.invoke('analysis:loadCache', songId),
        saveCache: (songId: string, cache: any) => ipcRenderer.invoke('analysis:saveCache', songId, cache),
    },
    export: {
        saveWebM: (songId: string, fileData: ArrayBuffer, suggestedName: string) => ipcRenderer.invoke('export:saveWebM', songId, fileData, suggestedName),
        ffmpegAvailable: () => ipcRenderer.invoke('export:ffmpegAvailable'),
        encodeMp4FromWebM: (inputWebMPath: string, outputMp4Path: string) => ipcRenderer.invoke('export:encodeMp4FromWebM', inputWebMPath, outputMp4Path),
        copyFontsForExport: (songId: string, fontFiles: string[]) => ipcRenderer.invoke('export:copyFonts', songId, fontFiles),
        packageWolk: (songId: string, outputName: string) => ipcRenderer.invoke('export:packageWolk', songId, outputName),
        importWolk: (filePath: string, strategy: 'override' | 'copy') => ipcRenderer.invoke('export:importWolk', filePath, strategy),
        importWolkBytes: (fileData: ArrayBuffer, strategy: 'override' | 'copy') => ipcRenderer.invoke('export:importWolkBytes', fileData, strategy),
    },

    // Event methods
    on(channel: string, callback: (...args: any[]) => void) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    removeAllListeners(channel: string) {
        ipcRenderer.removeAllListeners(channel);
    }
});