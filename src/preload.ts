import { contextBridge, ipcRenderer } from 'electron';
import type { WolkProject } from '@/types/project_types';
import type { MotionPresetDocument, MotionPresetSaveInput, MotionPresetSummary } from '@/types/motion_preset_types';

declare global {
    interface Window {
        electronAPI: {
            getRandomNumber: () => Promise<number>;
            openStorageFolder: () => Promise<string>;
            openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
            projects: {
                create: (initial?: { title?: string; audioSrc?: string; coverSrc?: string }) => Promise<WolkProject>;
                save: (project: WolkProject) => Promise<WolkProject>;
                load: (projectId: string) => Promise<WolkProject | null>;
                list: () => Promise<WolkProject[]>;
                delete: (projectId: string) => Promise<boolean>;
                uploadAudio: (projectId: string, fileData: ArrayBuffer, originalFileName: string) => Promise<WolkProject>;
                uploadCover: (projectId: string, fileData: ArrayBuffer, originalFileName: string) => Promise<WolkProject>;
                uploadAsset: (
                    projectId: string,
                    fileData: ArrayBuffer,
                    originalFileName: string,
                    preferredFileName?: string,
                ) => Promise<{ url: string; fileName: string }>;
            };
            motionPresets: {
                list: (blockType: string) => Promise<MotionPresetSummary[]>;
                load: (blockType: string, presetId: string) => Promise<MotionPresetDocument | null>;
                save: (preset: MotionPresetSaveInput) => Promise<MotionPresetDocument>;
                delete: (blockType: string, presetId: string) => Promise<boolean>;
            };
            fonts: {
                list: () => Promise<{
                    familyGuess: string;
                    filePath: string;
                    fileName: string;
                    guessStyle?: 'normal' | 'italic' | 'oblique';
                    guessWeight?: number;
                }[]>;
            };
            export: {
                saveWebM: (documentId: string, fileData: ArrayBuffer, suggestedName: string, titleHint?: string) => Promise<any>;
                ffmpegAvailable: () => Promise<boolean>;
                getFfmpegInstructions: () => Promise<{ instructions?: string }>;
                encodeMp4FromWebM: (inputWebMPath: string, outputMp4Path: string) => Promise<any>;
                copyFontsForExport: (documentId: string, fontFiles: string[]) => Promise<{ copied: string[] }>;
                openFolder: (folderPath: string) => Promise<any>;
                cleanupFrames: (framesDir: string) => Promise<any>;
                createFrameExport: (documentId: string, titleHint?: string) => Promise<any>;
                saveFrame: (framesDir: string, frameName: string, frameData: ArrayBuffer) => Promise<any>;
                copyAudioForExport: (rootDir: string, audioPath: string) => Promise<any>;
                assembleVideo: (framesDir: string, rootDir: string, fps: number, audioPath: string | null) => Promise<any>;
            };
            on: (channel: string, callback: (...args: any[]) => void) => void;
            removeAllListeners: (channel: string) => void;
        };
    }
}

ipcRenderer.send('renderer-ready');

contextBridge.exposeInMainWorld('electronAPI', {
    getRandomNumber: () => ipcRenderer.invoke('getRandomNumber'),
    openStorageFolder: () => ipcRenderer.invoke('open-storage-folder'),
    openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
    projects: {
        create: (initial?: { title?: string; audioSrc?: string; coverSrc?: string }) => ipcRenderer.invoke('projects:create', initial),
        save: (project: WolkProject) => ipcRenderer.invoke('projects:save', project),
        load: (projectId: string) => ipcRenderer.invoke('projects:load', projectId),
        list: () => ipcRenderer.invoke('projects:list'),
        delete: (projectId: string) => ipcRenderer.invoke('projects:delete', projectId),
        uploadAudio: (projectId: string, fileData: ArrayBuffer, originalFileName: string) => ipcRenderer.invoke('projects:uploadAudio', projectId, fileData, originalFileName),
        uploadCover: (projectId: string, fileData: ArrayBuffer, originalFileName: string) => ipcRenderer.invoke('projects:uploadCover', projectId, fileData, originalFileName),
        uploadAsset: (projectId: string, fileData: ArrayBuffer, originalFileName: string, preferredFileName?: string) => ipcRenderer.invoke('projects:uploadAsset', projectId, fileData, originalFileName, preferredFileName),
    },
    motionPresets: {
        list: (blockType: string) => ipcRenderer.invoke('motion-presets:list', blockType),
        load: (blockType: string, presetId: string) => ipcRenderer.invoke('motion-presets:load', blockType, presetId),
        save: (preset: MotionPresetSaveInput) => ipcRenderer.invoke('motion-presets:save', preset),
        delete: (blockType: string, presetId: string) => ipcRenderer.invoke('motion-presets:delete', blockType, presetId),
    },
    fonts: {
        list: () => ipcRenderer.invoke('fonts:list'),
    },
    export: {
        saveWebM: (documentId: string, fileData: ArrayBuffer, suggestedName: string, titleHint?: string) => ipcRenderer.invoke('export:saveWebM', documentId, fileData, suggestedName, titleHint),
        ffmpegAvailable: () => ipcRenderer.invoke('export:ffmpegAvailable'),
        getFfmpegInstructions: () => ipcRenderer.invoke('export:getFfmpegInstructions'),
        encodeMp4FromWebM: (inputWebMPath: string, outputMp4Path: string) => ipcRenderer.invoke('export:encodeMp4FromWebM', inputWebMPath, outputMp4Path),
        copyFontsForExport: (documentId: string, fontFiles: string[]) => ipcRenderer.invoke('export:copyFonts', documentId, fontFiles),
        openFolder: (folderPath: string) => ipcRenderer.invoke('export:openFolder', folderPath),
        cleanupFrames: (framesDir: string) => ipcRenderer.invoke('export:cleanupFrames', framesDir),
        createFrameExport: (documentId: string, titleHint?: string) => ipcRenderer.invoke('export:createFrameExport', documentId, titleHint),
        saveFrame: (framesDir: string, frameName: string, frameData: ArrayBuffer) => ipcRenderer.invoke('export:saveFrame', framesDir, frameName, frameData),
        copyAudioForExport: (rootDir: string, audioPath: string) => ipcRenderer.invoke('export:copyAudioForExport', rootDir, audioPath),
        assembleVideo: (framesDir: string, rootDir: string, fps: number, audioPath: string | null) => ipcRenderer.invoke('export:assembleVideo', framesDir, rootDir, fps, audioPath),
    },
    on(channel: string, callback: (...args: any[]) => void) {
        ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    removeAllListeners(channel: string) {
        ipcRenderer.removeAllListeners(channel);
    },
});
