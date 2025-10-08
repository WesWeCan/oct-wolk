import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';
import { getDocStoragePath } from './internal-storage';
import type { Song } from '@/types/song_types';

const getSongsRoot = (): string => {
    return getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
};

const getSongDir = (songId: string): string => {
    return path.join(getSongsRoot(), songId);
};

const getSongJsonPath = (songId: string): string => {
    return path.join(getSongDir(songId), 'song.json');
};

export const listSongs = (): Song[] => {
    const root = getSongsRoot();
    if (!fs.existsSync(root)) return [];
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const songs: Song[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const songId = entry.name;
        const jsonPath = getSongJsonPath(songId);
        if (!fs.existsSync(jsonPath)) continue;
        try {
            const json = fs.readFileSync(jsonPath, 'utf-8');
            const data = JSON.parse(json) as Song;
            // Basic validation: id must match folder
            if (data && typeof data.id === 'string') {
                songs.push(data);
            }
        } catch {
            // ignore broken files
        }
    }
    // Newest first
    songs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return songs;
};

export const loadSong = (songId: string): Song | null => {
    const jsonPath = getSongJsonPath(songId);
    if (!fs.existsSync(jsonPath)) return null;
    try {
        const json = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(json) as Song;
    } catch {
        return null;
    }
};

export const createSong = (initial?: Partial<Omit<Song, 'id' | 'createdAt' | 'updatedAt'>>): Song => {
    const id = randomUUID();
    const now = Date.now();
    const song: Song = {
        id,
        title: initial?.title ?? 'Untitled',
        subtitle: initial?.subtitle ?? '',
        audioSrc: initial?.audioSrc ?? '',
        imageSrc: initial?.imageSrc ?? '',
        lyrics: initial?.lyrics ?? '',
        wordBank: Array.isArray(initial?.wordBank) ? initial!.wordBank! : [],
        paragraphs: Array.isArray(initial?.paragraphs) ? initial!.paragraphs! : [],
        wordGroups: Array.isArray(initial?.wordGroups) ? initial!.wordGroups! : [],
        createdAt: now,
        updatedAt: now,
    };
    const dir = getSongDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getSongJsonPath(id), JSON.stringify(song, null, 2), 'utf-8');
    return song;
};

export const saveSong = (song: Song): Song => {
    if (!song || !song.id) {
        throw new Error('Invalid song: missing id');
    }
    const existing = loadSong(song.id);
    const now = Date.now();
    const toSave: Song = {
        ...existing,
        ...song,
        updatedAt: now,
        createdAt: existing?.createdAt ?? song.createdAt ?? now,
    } as Song;
    const dir = getSongDir(song.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getSongJsonPath(song.id), JSON.stringify(toSave, null, 2), 'utf-8');
    return toSave;
};

const getSongAssetPath = (songId: string, baseName: 'cover' | 'audio', originalFileName: string): string => {
    const ext = (path.extname(originalFileName) || '').toLowerCase();
    const fileName = `${baseName}${ext}`;
    return path.join(getSongDir(songId), fileName);
};

const deleteIfExists = (filePath: string) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
        // ignore
    }
};

export const saveSongCover = (songId: string, fileData: ArrayBuffer, originalFileName: string): Song => {
    const dir = getSongDir(songId);
    fs.mkdirSync(dir, { recursive: true });

    const existing = loadSong(songId);
    if (!existing) {
        throw new Error('Song not found');
    }

    // remove previous cover if extension differs
    if (existing.imageSrc) {
        try {
            const prevFile = existing.imageSrc.replace(`wolk://${songId}/`, '');
            if (prevFile) deleteIfExists(path.join(dir, prevFile));
        } catch {}
    }

    const targetPath = getSongAssetPath(songId, 'cover', originalFileName);
    const buffer = Buffer.from(fileData);
    fs.writeFileSync(targetPath, buffer);

    const updated: Song = saveSong({
        ...existing,
        imageSrc: `wolk://${songId}/${path.basename(targetPath)}`,
    } as Song);

    return updated;
};

export const saveSongAudio = (songId: string, fileData: ArrayBuffer, originalFileName: string): Song => {
    const dir = getSongDir(songId);
    fs.mkdirSync(dir, { recursive: true });

    const existing = loadSong(songId);
    if (!existing) {
        throw new Error('Song not found');
    }

    // remove previous audio if extension differs
    if (existing.audioSrc) {
        try {
            const prevFile = existing.audioSrc.replace(`wolk://${songId}/`, '');
            if (prevFile) deleteIfExists(path.join(dir, prevFile));
        } catch {}
    }

    const targetPath = getSongAssetPath(songId, 'audio', originalFileName);
    const buffer = Buffer.from(fileData);
    fs.writeFileSync(targetPath, buffer);

    const updated: Song = saveSong({
        ...existing,
        audioSrc: `wolk://${songId}/${path.basename(targetPath)}`,
    } as Song);

    return updated;
};


export const saveSongAsset = (songId: string, fileData: ArrayBuffer, originalFileName: string, preferredFileName?: string): { url: string; fileName: string } => {
    const dir = getSongDir(songId);
    const assetsDir = path.join(dir, 'assets');
    try { fs.mkdirSync(assetsDir, { recursive: true }); } catch {}
    const baseRequested = String(preferredFileName || originalFileName || 'asset').replace(/[^a-zA-Z0-9-_\.]/g, '_');
    const ext = path.extname(baseRequested) || path.extname(String(originalFileName || '')) || '';
    const baseNoExt = path.basename(baseRequested, ext) || 'asset';
    let candidate = `${baseNoExt}${ext}`;
    let targetPath = path.join(assetsDir, candidate);
    // ensure unique file name if collision
    let counter = 1;
    while (fs.existsSync(targetPath)) {
        candidate = `${baseNoExt}_${counter}${ext}`;
        targetPath = path.join(assetsDir, candidate);
        counter++;
    }
    const buffer = Buffer.from(fileData);
    fs.writeFileSync(targetPath, buffer);
    return { url: `wolk://${songId}/assets/${path.basename(targetPath)}`, fileName: path.basename(targetPath) };
};

export const deleteSongAsset = (songId: string, fileName: string): boolean => {
    try {
        if (!fileName) return false;
        const dir = getSongDir(songId);
        const assetsDir = path.join(dir, 'assets');
        const targetPath = path.join(assetsDir, path.basename(fileName));
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
            return true;
        }
    } catch {
        // ignore
    }
    return false;
};

/**
 * Recursively deletes a directory and all its contents.
 */
const deleteDirRecursive = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) return;
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            deleteDirRecursive(fullPath);
        } else {
            fs.unlinkSync(fullPath);
        }
    }
    fs.rmdirSync(dirPath);
};

/**
 * Deletes a song and all its associated files.
 * @param songId - The ID of the song to delete
 * @returns true if deletion was successful, false otherwise
 */
export const deleteSong = (songId: string): boolean => {
    try {
        if (!songId) return false;
        
        const songDir = getSongDir(songId);
        
        // Safety check: ensure we're deleting within the songs directory
        const songsRoot = getSongsRoot();
        if (!songDir.startsWith(songsRoot)) {
            console.error('Security: Attempted to delete directory outside songs root');
            return false;
        }
        
        // Check if song exists
        if (!fs.existsSync(songDir)) {
            return false;
        }
        
        // Delete the entire song directory recursively
        deleteDirRecursive(songDir);
        
        return true;
    } catch (error) {
        console.error('Failed to delete song:', error);
        return false;
    }
};


