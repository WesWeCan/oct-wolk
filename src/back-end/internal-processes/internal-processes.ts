import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { getInternalStoragePath } from './internal-storage';
import { createOrLoadTimeline, saveTimeline, listScenes as listSceneFiles, saveScene, loadScene } from './timeline-storage';
import { listSystemFonts } from './fonts';
import { createSong, loadSong, saveSong, listSongs, saveSongCover, saveSongAudio } from './song-storage';
import fs from 'fs';
import path from 'path';
import { getDocStoragePath } from './internal-storage';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';
import os from 'os';
import { spawnSync } from 'child_process';
import { loadAnalysisCache, saveAnalysisCache } from './analysis-storage';



export const registerInternalProcesses = async () => {
    console.log('Registering internal processes...');
    
    // Existing IPC handler
    ipcMain.handle('getRandomNumber', () => {
        console.log('getRandomNumber IPC handler called');
        const number = Math.floor(Math.random() * 100);
        console.log('Generated random number:', number);
        return number;
    });

    ipcMain.handle('open-storage-folder', () => {
        return shell.openPath(getInternalStoragePath());
    });

    // Songs API
    ipcMain.handle('songs:create', (_event, initial) => {
        return createSong(initial);
    });
    ipcMain.handle('songs:save', (_event, song) => {
        return saveSong(song);
    });
    ipcMain.handle('songs:load', (_event, songId: string) => {
        return loadSong(songId);
    });
    ipcMain.handle('songs:list', () => {
        return listSongs();
    });

    // Uploads
    ipcMain.handle('songs:uploadCover', (_event, songId: string, fileData: ArrayBuffer, originalFileName: string) => {
        return saveSongCover(songId, fileData, originalFileName);
    });
    ipcMain.handle('songs:uploadAudio', (_event, songId: string, fileData: ArrayBuffer, originalFileName: string) => {
        return saveSongAudio(songId, fileData, originalFileName);
    });

    // Timeline API
    ipcMain.handle('timeline:createOrLoad', (_event, songId: string) => {
        return createOrLoadTimeline(songId);
    });
    ipcMain.handle('timeline:save', (_event, songId: string, timeline: any) => {
        return saveTimeline(songId, timeline);
    });
    ipcMain.handle('timeline:listScenes', (_event, songId: string) => {
        return listSceneFiles(songId);
    });
    ipcMain.handle('timeline:saveScene', (_event, songId: string, scene: any) => {
        return saveScene(songId, scene);
    });
    ipcMain.handle('timeline:loadScene', (_event, songId: string, sceneId: string) => {
        return loadScene(songId, sceneId);
    });

    // Fonts API
    ipcMain.handle('fonts:list', () => {
        return listSystemFonts();
    });

    // Analysis Cache API
    ipcMain.handle('analysis:loadCache', (_event, songId: string) => {
        return loadAnalysisCache(songId);
    });
    ipcMain.handle('analysis:saveCache', (_event, songId: string, cache: any) => {
        return saveAnalysisCache(songId, cache);
    });

    // Export API
    ipcMain.handle('export:saveWebM', (_event, songId: string, fileData: ArrayBuffer, suggestedName: string) => {
        const buf = Buffer.from(fileData);
        const song = loadSong(songId);
        const title = (song?.title || 'export').replace(/[^a-zA-Z0-9-_\.]+/g, '_');
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const MM = String(now.getMinutes()).padStart(2, '0');
        const SS = String(now.getSeconds()).padStart(2, '0');
        const folderName = `${title}_${yyyy}${mm}${dd}_${HH}${MM}${SS}`;
        const rootDir = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.EXPORTS), folderName);
        const webmDir = path.join(rootDir, 'webm');
        fs.mkdirSync(webmDir, { recursive: true });
        const base = suggestedName && typeof suggestedName === 'string' ? suggestedName.replace(/[^a-zA-Z0-9-_\.]/g, '') : `${folderName}.webm`;
        const filePath = path.join(webmDir, base.endsWith('.webm') ? base : `${base}.webm`);
        fs.writeFileSync(filePath, buf);
        return { filePath, rootDir, webmDir, folderName };
    });
    ipcMain.handle('export:copyFonts', (_event, songId: string, fontFiles: string[]) => {
        try {
            const songFontsDir = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), songId, 'fonts');
            fs.mkdirSync(songFontsDir, { recursive: true });
            const copied: string[] = [];
            for (const src of (Array.isArray(fontFiles) ? fontFiles : [])) {
                try {
                    const base = path.basename(String(src));
                    const dest = path.join(songFontsDir, base);
                    fs.copyFileSync(String(src), dest);
                    copied.push(dest);
                } catch {}
            }
            return { copied };
        } catch (e) {
            return { copied: [] };
        }
    });
    ipcMain.handle('export:packageWolk', (_event, songId: string, outputName: string) => {
        // Zip the song folder to Downloads as {outputName}
        const downloads = path.join(os.homedir(), 'Downloads');
        const srcDir = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), songId);
        const outPath = path.join(downloads, outputName);
        const archiver = require('zlib');
        // Minimal zip via system zip if available for robustness
        try {
            const child_process = require('child_process');
            child_process.execFileSync('zip', ['-r', outPath, '.'], { cwd: srcDir });
            return { filePath: outPath };
        } catch {
            // Fallback: naive tar.gz then rename to .wolk (not ideal, but placeholder)
            const gzPath = outPath.replace(/\.wolk$/i, '.tar.gz');
            try {
                const child_process = require('child_process');
                child_process.execFileSync('tar', ['-czf', gzPath, '.'], { cwd: srcDir });
                // Copy or rename to .wolk to satisfy extension requirement
                fs.copyFileSync(gzPath, outPath);
                return { filePath: outPath };
            } catch {}
        }
        return { filePath: null };
    });

    ipcMain.handle('export:ffmpegAvailable', () => {
        try {
            const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
            return res.status === 0;
        } catch {
            return false;
        }
    });
    ipcMain.handle('export:encodeMp4FromWebM', (_event, inputWebMPath: string, outputMp4Path: string) => {
        try {
            const args = ['-y', '-i', inputWebMPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', outputMp4Path];
            const res = spawnSync('ffmpeg', args, { stdio: 'ignore' });
            if (res.status === 0 && fs.existsSync(outputMp4Path)) {
                return { filePath: outputMp4Path };
            }
        } catch {}
        return { filePath: null };
    });

}