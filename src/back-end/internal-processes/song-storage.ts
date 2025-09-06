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


