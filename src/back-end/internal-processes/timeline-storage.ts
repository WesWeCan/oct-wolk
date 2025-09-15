import fs from 'fs';
import path from 'path';
import { getDocStoragePath } from './internal-storage';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';
import type { TimelineDocument, SceneDocumentBase, DEFAULT_PROJECT_SETTINGS } from '@/types/timeline_types';
import { DEFAULT_PROJECT_SETTINGS as DEFAULTS } from '@/types/timeline_types';

const getSongsRoot = (): string => {
    return getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
};

const getSongDir = (songId: string): string => {
    return path.join(getSongsRoot(), songId);
};

const getTimelineDir = (songId: string): string => {
    return path.join(getSongDir(songId), 'timeline');
};

const getScenesDir = (songId: string): string => {
    return path.join(getTimelineDir(songId), 'scenes');
};

const getTimelineJsonPath = (songId: string): string => {
    return path.join(getTimelineDir(songId), 'timeline.json');
};

export const ensureTimelineFolders = (songId: string) => {
    fs.mkdirSync(getSongDir(songId), { recursive: true });
    fs.mkdirSync(getTimelineDir(songId), { recursive: true });
    fs.mkdirSync(getScenesDir(songId), { recursive: true });
};

export const createOrLoadTimeline = (songId: string): TimelineDocument => {
    ensureTimelineFolders(songId);
    const timelinePath = getTimelineJsonPath(songId);
    if (!fs.existsSync(timelinePath)) {
        const doc: TimelineDocument = {
            settings: { ...DEFAULTS },
            scenes: [],
        };
        fs.writeFileSync(timelinePath, JSON.stringify(doc, null, 2), 'utf-8');
        return doc;
    }
    try {
        const json = fs.readFileSync(timelinePath, 'utf-8');
        const parsed = JSON.parse(json) as TimelineDocument;
        // Backfill defaults if missing
        parsed.settings = { ...DEFAULTS, ...(parsed.settings || {}) };
        parsed.scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
        // Keep optional fields if present
        if (parsed.actionTracks && !Array.isArray(parsed.actionTracks)) parsed.actionTracks = [] as any;
        return parsed;
    } catch {
        const fallback: TimelineDocument = { settings: { ...DEFAULTS }, scenes: [] };
        fs.writeFileSync(timelinePath, JSON.stringify(fallback, null, 2), 'utf-8');
        return fallback;
    }
};

export const saveTimeline = (songId: string, doc: TimelineDocument): TimelineDocument => {
    ensureTimelineFolders(songId);
    const toSave: TimelineDocument = {
        settings: { ...DEFAULTS, ...(doc.settings || {}) },
        scenes: Array.isArray(doc.scenes) ? doc.scenes : [],
        // Persist optional fields
        wordsPoolTrack: (doc as any).wordsPoolTrack,
        actionTracks: Array.isArray((doc as any).actionTracks) ? (doc as any).actionTracks : [],
    } as any;
    fs.writeFileSync(getTimelineJsonPath(songId), JSON.stringify(toSave, null, 2), 'utf-8');
    return toSave;
};

export const listScenes = (songId: string): string[] => {
    ensureTimelineFolders(songId);
    const scenesDir = getScenesDir(songId);
    if (!fs.existsSync(scenesDir)) return [];
    return fs.readdirSync(scenesDir)
        .filter(name => name.endsWith('.json'))
        .map(name => path.basename(name, '.json'));
};

export const saveScene = (songId: string, scene: SceneDocumentBase): SceneDocumentBase => {
    ensureTimelineFolders(songId);
    // Purge obsolete per-scene words.allowed track
    const cleaned = { ...scene, tracks: Array.isArray(scene.tracks) ? scene.tracks.filter(t => t?.propertyPath !== 'words.allowed') : [] } as SceneDocumentBase;
    const filePath = path.join(getScenesDir(songId), `${scene.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
    return cleaned;
};

export const loadScene = (songId: string, sceneId: string): SceneDocumentBase | null => {
    ensureTimelineFolders(songId);
    const filePath = path.join(getScenesDir(songId), `${sceneId}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const json = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(json) as SceneDocumentBase;
        // Purge obsolete per-scene words.allowed on load to complete migration
        if (Array.isArray(parsed?.tracks)) {
            parsed.tracks = parsed.tracks.filter((t: any) => t?.propertyPath !== 'words.allowed');
        }
        return parsed;
    } catch {
        return null;
    }
};


export const resetTimeline = (songId: string): TimelineDocument => {
    ensureTimelineFolders(songId);
    // delete all scene json files
    try {
        const dir = getScenesDir(songId);
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                try {
                    if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
                } catch {}
            }
        }
    } catch {}
    // write a minimal timeline.json keeping settings but clearing refs and actions
    let current: TimelineDocument;
    try {
        current = createOrLoadTimeline(songId);
    } catch {
        current = { settings: { ...DEFAULTS }, scenes: [] } as any;
    }
    const cleared: TimelineDocument = {
        settings: { ...DEFAULTS, ...(current.settings || {}) },
        scenes: [],
        actionTracks: [],
    } as any;
    fs.writeFileSync(getTimelineJsonPath(songId), JSON.stringify(cleared, null, 2), 'utf-8');
    return cleared;
};

