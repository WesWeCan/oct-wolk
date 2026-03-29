import { dialog, ipcMain, shell } from 'electron';

import { getInternalStoragePath, isPathInsideRoot } from './internal-storage';
import { listSystemFonts } from './fonts';
import { createProject, loadProject, saveProject, listProjects, deleteProject, saveProjectAudio, saveProjectCover, saveProjectAsset } from './project-storage';
import { deleteMotionPreset, listMotionPresets, loadMotionPreset, saveMotionPreset } from './motion-preset-storage';
import { exportProjectArchive, getProjectArchiveSuggestedFileName, importProjectArchiveFromBytes, importProjectArchiveFromPath } from './project-archive';
import {
    exportMotionPresetArchive,
    exportMotionPresetBundleArchive,
    getMotionPresetArchiveSuggestedFileName,
    getMotionPresetBundleSuggestedFileName,
    importMotionPresetArchiveFromPath,
} from './motion-preset-archive';
import fs from 'fs';
import path from 'path';
import { getDocStoragePath } from './internal-storage';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';
import { spawnSync } from 'child_process';
import {
    WOLK_PRESET_BUNDLE_EXTENSION,
    WOLK_PRESET_EXTENSION,
    WOLK_PROJECT_EXTENSION,
} from '@/types/archive_types';



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

    ipcMain.handle('open-external-url', async (_event, url: string) => {
        try {
            const parsed = new URL(String(url));
            const protocol = parsed.protocol.toLowerCase();
            if (protocol !== 'http:' && protocol !== 'https:') {
                return { success: false, error: 'Unsupported URL protocol' };
            }

            await shell.openExternal(parsed.toString());
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Projects API (v2)
    ipcMain.handle('projects:create', (_event, initial) => {
        return createProject(initial);
    });
    ipcMain.handle('projects:save', (_event, project) => {
        return saveProject(project);
    });
    ipcMain.handle('projects:load', (_event, projectId: string) => {
        return loadProject(projectId);
    });
    ipcMain.handle('projects:list', () => {
        return listProjects();
    });
    ipcMain.handle('projects:exportWolk', async (_event, projectId: string) => {
        try {
            const project = loadProject(projectId);
            if (!project) {
                return { canceled: false, error: 'Project not found.' };
            }

            const dialogResult = await dialog.showSaveDialog({
                title: 'Export .wolk project',
                defaultPath: getProjectArchiveSuggestedFileName(project),
                filters: [{ name: 'WOLK Project', extensions: [WOLK_PROJECT_EXTENSION] }],
            });
            if (dialogResult.canceled || !dialogResult.filePath) {
                return { canceled: true };
            }

            const filePath = dialogResult.filePath.endsWith(`.${WOLK_PROJECT_EXTENSION}`)
                ? dialogResult.filePath
                : `${dialogResult.filePath}.${WOLK_PROJECT_EXTENSION}`;
            const exportedProject = await exportProjectArchive(projectId, filePath);
            return { canceled: false, filePath, project: exportedProject };
        } catch (error) {
            return { canceled: false, error: String(error) };
        }
    });
    ipcMain.handle('projects:importWolk', async () => {
        try {
            const dialogResult = await dialog.showOpenDialog({
                title: 'Import .wolk project',
                properties: ['openFile'],
                filters: [{ name: 'WOLK Project', extensions: [WOLK_PROJECT_EXTENSION] }],
            });
            if (dialogResult.canceled || !dialogResult.filePaths[0]) {
                return { canceled: true };
            }

            const filePath = dialogResult.filePaths[0];
            const project = await importProjectArchiveFromPath(filePath);
            return { canceled: false, filePath, project };
        } catch (error) {
            return { canceled: false, error: String(error) };
        }
    });
    ipcMain.handle('projects:importWolkBytes', async (_event, fileName: string, fileData: ArrayBuffer) => {
        return importProjectArchiveFromBytes(fileName, fileData);
    });
    ipcMain.handle('projects:delete', (_event, projectId: string) => {
        return deleteProject(projectId);
    });
    ipcMain.handle('projects:uploadAudio', (_event, projectId: string, fileData: ArrayBuffer, originalFileName: string) => {
        return saveProjectAudio(projectId, fileData, originalFileName);
    });
    ipcMain.handle('projects:uploadCover', (_event, projectId: string, fileData: ArrayBuffer, originalFileName: string) => {
        return saveProjectCover(projectId, fileData, originalFileName);
    });
    ipcMain.handle('projects:uploadAsset', (_event, projectId: string, fileData: ArrayBuffer, originalFileName: string, preferredFileName?: string) => {
        return saveProjectAsset(projectId, fileData, originalFileName, preferredFileName);
    });

    ipcMain.handle('motion-presets:list', (_event, blockType: string) => {
        return listMotionPresets(blockType);
    });
    ipcMain.handle('motion-presets:load', (_event, blockType: string, presetId: string) => {
        return loadMotionPreset(blockType, presetId);
    });
    ipcMain.handle('motion-presets:save', (_event, preset) => {
        return saveMotionPreset(preset);
    });
    ipcMain.handle('motion-presets:delete', (_event, blockType: string, presetId: string) => {
        return deleteMotionPreset(blockType, presetId);
    });
    ipcMain.handle('motion-presets:exportOne', async (_event, blockType: string, presetId: string) => {
        try {
            const document = loadMotionPreset(blockType, presetId);
            if (!document) {
                return { canceled: false, error: 'Preset not found.' };
            }

            const dialogResult = await dialog.showSaveDialog({
                title: 'Export motion preset',
                defaultPath: getMotionPresetArchiveSuggestedFileName(document),
                filters: [{ name: 'WOLK Motion Preset', extensions: [WOLK_PRESET_EXTENSION] }],
            });
            if (dialogResult.canceled || !dialogResult.filePath) {
                return { canceled: true };
            }

            const filePath = dialogResult.filePath.endsWith(`.${WOLK_PRESET_EXTENSION}`)
                ? dialogResult.filePath
                : `${dialogResult.filePath}.${WOLK_PRESET_EXTENSION}`;
            await exportMotionPresetArchive(blockType, presetId, filePath);
            return { canceled: false, filePath, exportedCount: 1 };
        } catch (error) {
            return { canceled: false, error: String(error) };
        }
    });
    ipcMain.handle('motion-presets:importOne', async () => {
        try {
            const dialogResult = await dialog.showOpenDialog({
                title: 'Import motion preset',
                properties: ['openFile'],
                filters: [
                    { name: 'WOLK Motion Preset', extensions: [WOLK_PRESET_EXTENSION, WOLK_PRESET_BUNDLE_EXTENSION] },
                ],
            });
            if (dialogResult.canceled || !dialogResult.filePaths[0]) {
                return { canceled: true };
            }

            const filePath = dialogResult.filePaths[0];
            const imported = await importMotionPresetArchiveFromPath(filePath);
            return { canceled: false, filePath, imported };
        } catch (error) {
            return { canceled: false, error: String(error) };
        }
    });
    ipcMain.handle('motion-presets:exportBundle', async () => {
        try {
            const dialogResult = await dialog.showSaveDialog({
                title: 'Export motion preset bundle',
                defaultPath: getMotionPresetBundleSuggestedFileName(),
                filters: [{ name: 'WOLK Motion Presets', extensions: [WOLK_PRESET_BUNDLE_EXTENSION] }],
            });
            if (dialogResult.canceled || !dialogResult.filePath) {
                return { canceled: true };
            }

            const filePath = dialogResult.filePath.endsWith(`.${WOLK_PRESET_BUNDLE_EXTENSION}`)
                ? dialogResult.filePath
                : `${dialogResult.filePath}.${WOLK_PRESET_BUNDLE_EXTENSION}`;
            const exportedCount = await exportMotionPresetBundleArchive(filePath);
            return { canceled: false, filePath, exportedCount };
        } catch (error) {
            return { canceled: false, error: String(error) };
        }
    });
    ipcMain.handle('motion-presets:importBundle', async () => {
        try {
            const dialogResult = await dialog.showOpenDialog({
                title: 'Import motion preset bundle',
                properties: ['openFile'],
                filters: [{ name: 'WOLK Motion Presets', extensions: [WOLK_PRESET_BUNDLE_EXTENSION, WOLK_PRESET_EXTENSION] }],
            });
            if (dialogResult.canceled || !dialogResult.filePaths[0]) {
                return { canceled: true };
            }

            const filePath = dialogResult.filePaths[0];
            const imported = await importMotionPresetArchiveFromPath(filePath);
            return { canceled: false, filePath, imported };
        } catch (error) {
            return { canceled: false, error: String(error) };
        }
    });

    // Fonts API
    ipcMain.handle('fonts:list', () => {
        return listSystemFonts();
    });

    // Export API
    ipcMain.handle('export:saveWebM', (_event, documentId: string, fileData: ArrayBuffer, suggestedName: string, titleHint?: string) => {
        const buf = Buffer.from(fileData);
        const title = String(titleHint || 'export').replace(/[^a-zA-Z0-9-_\.]+/g, '_');
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
    ipcMain.handle('export:copyFonts', (_event, documentId: string, fontFiles: string[]) => {
        try {
            const songFontsDir = path.join(getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS), documentId, 'fonts');
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
    
    ipcMain.handle('export:createFrameExport', (_event, documentId: string, titleHint?: string) => {
        try {
            const title = String(titleHint || 'export').replace(/[^a-zA-Z0-9-_\.]+/g, '_');
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