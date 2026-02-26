import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { getInternalStoragePath, isPathInsideRoot } from './internal-storage';
import { createOrLoadTimeline, saveTimeline, listScenes as listSceneFiles, saveScene, loadScene, resetTimeline } from './timeline-storage';
import { listSystemFonts } from './fonts';
import { createSong, loadSong, saveSong, listSongs, saveSongCover, saveSongAudio, saveSongAsset, deleteSongAsset, deleteSong } from './song-storage';
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
    ipcMain.handle('songs:delete', (_event, songId: string) => {
        return deleteSong(songId);
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

    // Helper to find ffmpeg executable, checking common install locations
    const findFfmpegPath = (): string | null => {
        // Try PATH first (works in dev and some packaged scenarios)
        try {
            const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
            if (res.status === 0) return 'ffmpeg';
        } catch {}

        // Check common installation paths for packaged apps
        const commonPaths: string[] = [];
        
        if (process.platform === 'darwin') {
            // macOS - Homebrew and common locations
            commonPaths.push(
                '/opt/homebrew/bin/ffmpeg',     // Apple Silicon Homebrew
                '/usr/local/bin/ffmpeg',         // Intel Homebrew
                '/opt/local/bin/ffmpeg',         // MacPorts
                path.join(process.env.HOME || '', '.local', 'bin', 'ffmpeg')
            );
        } else if (process.platform === 'win32') {
            // Windows - common install locations
            commonPaths.push(
                'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
                'C:\\ffmpeg\\bin\\ffmpeg.exe',
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
                path.join(process.env.PROGRAMFILES || '', 'ffmpeg', 'bin', 'ffmpeg.exe')
            );
        } else {
            // Linux - common install locations
            commonPaths.push(
                '/usr/bin/ffmpeg',
                '/usr/local/bin/ffmpeg',
                '/snap/bin/ffmpeg',
                path.join(process.env.HOME || '', '.local', 'bin', 'ffmpeg')
            );
        }

        // Test each common path
        for (const ffmpegPath of commonPaths) {
            try {
                if (fs.existsSync(ffmpegPath)) {
                    const res = spawnSync(ffmpegPath, ['-version'], { stdio: 'ignore' });
                    if (res.status === 0) {
                        console.log('[ffmpeg] Found at:', ffmpegPath);
                        return ffmpegPath;
                    }
                }
            } catch {}
        }

        return null;
    };

    // Cache the ffmpeg path to avoid repeated searches
    let cachedFfmpegPath: string | null | undefined = undefined;

    ipcMain.handle('export:ffmpegAvailable', () => {
        if (cachedFfmpegPath === undefined) {
            cachedFfmpegPath = findFfmpegPath();
        }
        return cachedFfmpegPath !== null;
    });
    
    ipcMain.handle('export:getFfmpegInstructions', () => {
        const platform = process.platform;
        let instructions = '';
        
        if (platform === 'darwin') {
            // macOS
            instructions = `Install ffmpeg via Homebrew:

brew install ffmpeg

Verify installation:
ffmpeg -version`;
        } else if (platform === 'win32') {
            // Windows
            instructions = `Install ffmpeg via package manager:

Option 1 - winget (Windows 10+):
  winget install ffmpeg

Option 2 - Chocolatey:
  choco install ffmpeg

Option 3 - Scoop:
  scoop install ffmpeg

Option 4 - Manual Download:
  1. Download from: https://www.gyan.dev/ffmpeg/builds/
  2. Extract the archive
  3. Add the bin folder to your system PATH

Verify installation:
ffmpeg -version`;
        } else {
            // Linux
            instructions = `Install ffmpeg via your package manager:

Ubuntu/Debian:
  sudo apt update
  sudo apt install ffmpeg

Fedora/RHEL/CentOS:
  sudo dnf install ffmpeg

Arch Linux:
  sudo pacman -S ffmpeg

Verify installation:
ffmpeg -version`;
        }
        
        return { platform, instructions };
    });
    
    ipcMain.handle('export:encodeMp4FromWebM', (_event, inputWebMPath: string, outputMp4Path: string) => {
        try {
            // Ensure we have the cached ffmpeg path
            if (cachedFfmpegPath === undefined) {
                cachedFfmpegPath = findFfmpegPath();
            }
            
            if (!cachedFfmpegPath) {
                console.error('[ffmpeg] Not found, cannot encode MP4');
                return { filePath: null };
            }

            const args = ['-y', '-i', inputWebMPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', outputMp4Path];
            const res = spawnSync(cachedFfmpegPath, args, { stdio: 'ignore' });
            if (res.status === 0 && fs.existsSync(outputMp4Path)) {
                return { filePath: outputMp4Path };
            }
        } catch (error) {
            console.error('[ffmpeg] Encoding error:', error);
        }
        return { filePath: null };
    });
    
    ipcMain.handle('export:openFolder', async (_event, folderPath: string) => {
        try {
            const storageRoot = getInternalStoragePath();
            if (!isPathInsideRoot(folderPath, storageRoot)) {
                return { success: false, error: 'Path outside storage directory' };
            }
            if (fs.existsSync(folderPath)) {
                await shell.openPath(folderPath);
                return { success: true };
            }
            return { success: false, error: 'Folder not found' };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
    
    ipcMain.handle('export:cleanupFrames', async (_event, framesDir: string) => {
        try {
            const exportsRoot = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.EXPORTS);
            if (!isPathInsideRoot(framesDir, exportsRoot)) {
                return { success: false, error: 'Path outside exports directory' };
            }
            if (fs.existsSync(framesDir)) {
                fs.rmSync(framesDir, { recursive: true, force: true });
                return { success: true };
            }
            return { success: false, error: 'Frames directory not found' };
        } catch (error) {
            console.error('Failed to cleanup frames:', error);
            return { success: false, error: String(error) };
        }
    });
    
    ipcMain.handle('export:createFrameExport', (_event, songId: string) => {
        try {
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
            const framesDir = path.join(rootDir, 'frames');
            fs.mkdirSync(framesDir, { recursive: true });
            return { rootDir, framesDir, folderName };
        } catch (error) {
            console.error('Failed to create frame export folder:', error);
            return { rootDir: null, framesDir: null, error: String(error) };
        }
    });
    
    ipcMain.handle('export:saveFrame', (_event, framesDir: string, frameName: string, frameData: ArrayBuffer) => {
        try {
            const exportsRoot = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.EXPORTS);
            if (!isPathInsideRoot(framesDir, exportsRoot)) {
                return { success: false, error: 'Path outside exports directory' };
            }
            const buf = Buffer.from(frameData);
            const filePath = path.join(framesDir, frameName);
            if (!isPathInsideRoot(filePath, framesDir)) {
                return { success: false, error: 'Invalid frame name' };
            }
            fs.writeFileSync(filePath, buf);
            return { success: true, filePath };
        } catch (error) {
            console.error('Failed to save frame:', error);
            return { success: false, error: String(error) };
        }
    });
    
    ipcMain.handle('export:copyAudioForExport', (_event, rootDir: string, audioPath: string) => {
        try {
            // Handle wolk:// protocol by converting to file path
            // Audio files are stored as: songs/{songId}/audio.{ext} (not in an audio subfolder)
            // Format: wolk://{songId}/audio.{ext}
            let actualAudioPath = audioPath;
            if (audioPath.startsWith('wolk://')) {
                // Extract song ID and filename from wolk:// URL
                // Format: wolk://{songId}/{filename} where filename is like "audio.mp3"
                const match = audioPath.match(/wolk:\/\/([^\/]+)\/(.+)/);
                if (match) {
                    const [, songId, filename] = match;
                    // Audio files are directly in the song folder, not in an audio subfolder
                    actualAudioPath = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), songId, filename);
                } else {
                    return { success: false, error: `Invalid wolk:// URL format: ${audioPath}` };
                }
            } else if (audioPath.startsWith('file://')) {
                actualAudioPath = audioPath.replace('file://', '');
            }
            
            if (!fs.existsSync(actualAudioPath)) {
                return { success: false, error: `Audio file not found at: ${actualAudioPath}` };
            }
            
            // Create audio subfolder in export directory
            const audioDir = path.join(rootDir, 'audio');
            fs.mkdirSync(audioDir, { recursive: true });
            
            // Copy audio file to export/audio folder
            const audioExt = path.extname(actualAudioPath);
            const audioFileName = `audio${audioExt}`;
            const destAudioPath = path.join(audioDir, audioFileName);
            fs.copyFileSync(actualAudioPath, destAudioPath);
            
            return { success: true, audioPath: destAudioPath };
        } catch (error) {
            console.error('[export:copyAudioForExport] Failed to copy audio file:', error);
            return { success: false, error: String(error) };
        }
    });
    
    ipcMain.handle('export:assembleVideo', async (_event, framesDir: string, rootDir: string, fps: number, audioPath: string | null) => {
        try {
            const exportsRoot = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.EXPORTS);
            if (!isPathInsideRoot(framesDir, exportsRoot) || !isPathInsideRoot(rootDir, exportsRoot)) {
                return { success: false, error: 'Path outside exports directory' };
            }

            if (cachedFfmpegPath === undefined) {
                cachedFfmpegPath = findFfmpegPath();
            }
            
            if (!cachedFfmpegPath) {
                return { success: false, error: 'ffmpeg is not available' };
            }
            
            const outputPath = path.join(rootDir, 'export.mp4');
            
            // Build ffmpeg arguments
            // Order matters: all inputs first, then filters, then codecs, then output
            const args = [
                '-y', // Overwrite output file
                '-framerate', String(fps),
                '-i', path.join(framesDir, 'frame_%06d.png'), // Video input pattern
            ];
            
            // Add audio input if provided (must come before filters/codecs)
            // audioPath should already be a local file path (copied to export folder)
            if (audioPath) {
                // audioPath is already a local file path (from copyAudioForExport)
                if (fs.existsSync(audioPath)) {
                    args.push('-i', audioPath); // Audio input
                } else {
                    console.warn('Audio file not found at:', audioPath);
                }
            }
            
            // Video filters (must come after all inputs)
            args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'); // Ensure dimensions are divisible by 2
            
            // Video codec options
            args.push('-c:v', 'libx264');
            args.push('-pix_fmt', 'yuv420p');
            args.push('-preset', 'medium');
            args.push('-crf', '18'); // High quality
            args.push('-movflags', '+faststart');
            
            // Audio codec options (if audio was added)
            if (audioPath && fs.existsSync(audioPath)) {
                args.push('-c:a', 'aac');
                args.push('-b:a', '192k');
                args.push('-shortest'); // End when shortest stream ends
            }
            
            // Output file (must be last)
            args.push(outputPath);
            
            // Run ffmpeg
            const result = spawnSync(cachedFfmpegPath, args, { encoding: 'utf-8', stdio: 'pipe' });
            
            if (result.status !== 0) {
                console.error('ffmpeg error:', result.stderr);
                return { success: false, error: result.stderr || 'ffmpeg failed' };
            }
            
            if (!fs.existsSync(outputPath)) {
                return { success: false, error: 'Output file was not created' };
            }
            
            return { success: true, outputPath };
        } catch (error) {
            console.error('Failed to assemble video:', error);
            return { success: false, error: String(error) };
        }
    });

}