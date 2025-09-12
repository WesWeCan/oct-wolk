import fs from 'fs';
import path from 'path';
import { getDocStoragePath } from './internal-storage';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';

const getSongsRoot = (): string => {
    return getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
};

const getSongDir = (songId: string): string => {
    return path.join(getSongsRoot(), songId);
};

const getCacheDir = (songId: string): string => {
    return path.join(getSongDir(songId), 'cache');
};

const getAnalysisCachePath = (songId: string): string => {
    return path.join(getCacheDir(songId), 'audio-analysis.json');
};

export const ensureCacheFolder = (songId: string) => {
    fs.mkdirSync(getCacheDir(songId), { recursive: true });
};

export const loadAnalysisCache = (songId: string): any | null => {
    ensureCacheFolder(songId);
    const filePath = getAnalysisCachePath(songId);
    if (!fs.existsSync(filePath)) return null;
    try {
        const json = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(json);
    } catch {
        return null;
    }
};

export const saveAnalysisCache = (songId: string, cache: any): { ok: boolean } => {
    try {
        ensureCacheFolder(songId);
        fs.writeFileSync(getAnalysisCachePath(songId), JSON.stringify(cache, null, 2), 'utf-8');
        return { ok: true };
    } catch {
        return { ok: false };
    }
};


