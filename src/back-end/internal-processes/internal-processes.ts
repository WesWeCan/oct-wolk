import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { getInternalStoragePath } from './internal-storage';
import { createOrLoadTimeline, saveTimeline, listScenes as listSceneFiles, saveScene, loadScene, resetTimeline } from './timeline-storage';
import { listSystemFonts } from './fonts';
import { createSong, loadSong, saveSong, listSongs, saveSongCover, saveSongAudio, saveSongAsset, deleteSongAsset } from './song-storage';
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
    ipcMain.handle('songs:uploadAsset', (_event, songId: string, fileData: ArrayBuffer, originalFileName: string, preferredFileName?: string) => {
        return saveSongAsset(songId, fileData, originalFileName, preferredFileName);
    });
    ipcMain.handle('songs:deleteAsset', (_event, songId: string, fileName: string) => {
        return deleteSongAsset(songId, fileName);
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
    ipcMain.handle('project:resetTimeline', (_event, songId: string) => {
        try {
            const doc = resetTimeline(songId);
            return { ok: true, doc };
        } catch (e) {
            return { ok: false };
        }
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

    ipcMain.handle('export:importWolk', async (_event, filePath: string, strategy: 'override' | 'copy') => {
        try {
            const src = String(filePath);
            if (!fs.existsSync(src)) return { songId: '', error: 'File not found' };
            const tmpBase = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), '__import');
            fs.mkdirSync(tmpBase, { recursive: true });
            const tmpDir = path.join(tmpBase, 'wolk_' + Date.now());
            fs.mkdirSync(tmpDir, { recursive: true });
            const child_process = require('child_process');
            let extracted = false;
            let lastErr: string | undefined;
            try {
                const res = child_process.spawnSync('unzip', ['-o', src, '-d', tmpDir], { encoding: 'utf-8' });
                if (res.status === 0) extracted = true; else lastErr = `unzip failed: ${res.stderr || res.stdout || ''}`;
            } catch (e: any) { lastErr = `unzip error: ${String(e?.message || e)}`; }
            if (!extracted) {
                try {
                    const res2 = child_process.spawnSync('tar', ['-xzf', src, '-C', tmpDir], { encoding: 'utf-8' });
                    if (res2.status === 0) extracted = true; else lastErr = `tar failed: ${res2.stderr || res2.stdout || ''}`;
                } catch (e2: any) { lastErr = `tar error: ${String(e2?.message || e2)}`; }
            }
            if (!extracted) {
                console.error('[importWolk] extract failed', lastErr);
                return { songId: '', error: lastErr || 'Failed to extract archive. Ensure it is a .zip or .tar.gz.' };
            }
            const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
            let importedRoot = tmpDir;
            const onlyDir = entries.filter((e: any) => e.isDirectory());
            if (onlyDir.length === 1) importedRoot = path.join(tmpDir, onlyDir[0].name);
            const songJsonPath = path.join(importedRoot, 'song.json');
            if (!fs.existsSync(songJsonPath)) {
                console.error('[importWolk] song.json not found in', importedRoot);
                return { songId: '', error: 'Invalid .wolk: song.json not found' };
            }
            const songData = JSON.parse(fs.readFileSync(songJsonPath, 'utf-8')) as { id: string; title?: string };
            if (!songData?.id) return { songId: '', error: 'Invalid song.json: missing id' };
            const destRoot = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
            let destId = songData.id;
            if (strategy === 'copy' || (strategy !== 'override')) {
                destId = (require('crypto').randomUUID());
                try {
                    songData.id = destId as any;
                    fs.writeFileSync(path.join(importedRoot, 'song.json'), JSON.stringify(songData, null, 2), 'utf-8');
                } catch {}
            }
            const destDir = path.join(destRoot, destId);
            if (strategy === 'override') {
                try { fs.rmSync(destDir, { recursive: true, force: true }); } catch {}
            }
            fs.mkdirSync(destDir, { recursive: true });
            const copyRecursive = (srcDir: string, dstDir: string) => {
                const items = fs.readdirSync(srcDir, { withFileTypes: true });
                for (const it of items) {
                    const s = path.join(srcDir, it.name);
                    const d = path.join(dstDir, it.name);
                    if (it.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyRecursive(s, d); }
                    else { fs.copyFileSync(s, d); }
                }
            };
            copyRecursive(importedRoot, destDir);
            return { songId: destId };
        } catch (e: any) {
            console.error('[importWolk] error', e);
            return { songId: '', error: String(e?.message || e) };
        }
    });

    ipcMain.handle('export:importWolkBytes', async (_event, fileData: ArrayBuffer, strategy: 'override' | 'copy') => {
        try {
            const uploadsDir = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), '__uploads');
            fs.mkdirSync(uploadsDir, { recursive: true });
            const tmpPath = path.join(uploadsDir, `import_${Date.now()}.wolk`);
            fs.writeFileSync(tmpPath, Buffer.from(fileData));
            try {
                const tmpBase = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), '__import');
                fs.mkdirSync(tmpBase, { recursive: true });
                const tmpDir = path.join(tmpBase, 'wolk_' + Date.now());
                fs.mkdirSync(tmpDir, { recursive: true });
                const child_process = require('child_process');
                let extracted = false;
                let lastErr: string | undefined;
                try {
                    const res = child_process.spawnSync('unzip', ['-o', tmpPath, '-d', tmpDir], { encoding: 'utf-8' });
                    if (res.status === 0) extracted = true; else lastErr = `unzip failed: ${res.stderr || res.stdout || ''}`;
                } catch (e: any) { lastErr = `unzip error: ${String(e?.message || e)}`; }
                if (!extracted) {
                    try {
                        const res2 = child_process.spawnSync('tar', ['-xzf', tmpPath, '-C', tmpDir], { encoding: 'utf-8' });
                        if (res2.status === 0) extracted = true; else lastErr = `tar failed: ${res2.stderr || res2.stdout || ''}`;
                    } catch (e2: any) { lastErr = `tar error: ${String(e2?.message || e2)}`; }
                }
                if (!extracted) {
                    console.error('[importWolkBytes] extract failed', lastErr);
                    return { songId: '', error: lastErr || 'Failed to extract archive. Ensure it is a .zip or .tar.gz.' };
                }
                const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
                let importedRoot = tmpDir;
                const onlyDir = entries.filter((e: any) => e.isDirectory());
                if (onlyDir.length === 1) importedRoot = path.join(tmpDir, onlyDir[0].name);
                const songJsonPath = path.join(importedRoot, 'song.json');
                if (!fs.existsSync(songJsonPath)) return { songId: '', error: 'Invalid .wolk: song.json not found' };
                const songData = JSON.parse(fs.readFileSync(songJsonPath, 'utf-8')) as { id: string; title?: string };
                if (!songData?.id) return { songId: '', error: 'Invalid song.json: missing id' };
                const destRoot = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
                let destId = songData.id;
                if (strategy === 'copy' || (strategy !== 'override')) {
                    destId = (require('crypto').randomUUID());
                    try {
                        songData.id = destId as any;
                        fs.writeFileSync(path.join(importedRoot, 'song.json'), JSON.stringify(songData, null, 2), 'utf-8');
                    } catch {}
                }
                const destDir = path.join(destRoot, destId);
                if (strategy === 'override') {
                    try { fs.rmSync(destDir, { recursive: true, force: true }); } catch {}
                }
                fs.mkdirSync(destDir, { recursive: true });
                const copyRecursive = (srcDir: string, dstDir: string) => {
                    const items = fs.readdirSync(srcDir, { withFileTypes: true });
                    for (const it of items) {
                        const s = path.join(srcDir, it.name);
                        const d = path.join(dstDir, it.name);
                        if (it.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyRecursive(s, d); }
                        else { fs.copyFileSync(s, d); }
                    }
                };
                copyRecursive(importedRoot, destDir);
                return { songId: destId };
            } catch (e: any) {
                console.error('[importWolkBytes] error', e);
                return { songId: '', error: String(e?.message || e) };
            } finally {
                try { fs.unlinkSync(tmpPath); } catch {}
            }
        } catch (e: any) {
            console.error('[importWolkBytes] error', e);
            return { songId: '', error: String(e?.message || e) };
        }
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