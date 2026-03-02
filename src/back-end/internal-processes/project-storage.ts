import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';
import { getDocStoragePath } from './internal-storage';
import type { WolkProject } from '@/types/project_types';
import { DEFAULT_PROJECT_SETTINGS, DEFAULT_PROJECT_FONT } from '@/types/project_types';

const getProjectsRoot = (): string => {
    return getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
};

const getProjectDir = (projectId: string): string => {
    return path.join(getProjectsRoot(), projectId);
};

const getProjectJsonPath = (projectId: string): string => {
    return path.join(getProjectDir(projectId), 'project.json');
};

const normalizeProject = (raw: WolkProject): WolkProject => {
    const anyRaw = raw as any;
    return {
        ...raw,
        settings: {
            ...DEFAULT_PROJECT_SETTINGS,
            ...(raw.settings || {}),
        },
        font: {
            ...DEFAULT_PROJECT_FONT,
            ...(raw.font || {}),
        },
        lyricTracks: Array.isArray(raw.lyricTracks) ? raw.lyricTracks : [],
        motionTracks: Array.isArray(anyRaw.motionTracks)
            ? anyRaw.motionTracks
            : (Array.isArray(anyRaw.motionLayers) ? anyRaw.motionLayers : []),
        backgroundImage: typeof anyRaw.backgroundImage === 'string' ? anyRaw.backgroundImage : undefined,
        backgroundColor: typeof anyRaw.backgroundColor === 'string' ? anyRaw.backgroundColor : '#000000',
        backgroundImageFit: anyRaw.backgroundImageFit === 'contain' || anyRaw.backgroundImageFit === 'stretch'
            ? anyRaw.backgroundImageFit
            : 'cover',
    };
};

export const listProjects = (): WolkProject[] => {
    const root = getProjectsRoot();
    try {
        if (!fs.existsSync(root)) return [];
    } catch {
        return [];
    }

    let entries: fs.Dirent[] = [];
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return [];
    }

    const projects: WolkProject[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const jsonPath = getProjectJsonPath(entry.name);
        if (!fs.existsSync(jsonPath)) continue;
        try {
            const json = fs.readFileSync(jsonPath, 'utf-8');
            const data = normalizeProject(JSON.parse(json) as WolkProject);
            if (data && data.version === 2 && typeof data.id === 'string') {
                projects.push(data);
            }
        } catch {
            // skip broken files
        }
    }

    projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return projects;
};

export const loadProject = (projectId: string): WolkProject | null => {
    const jsonPath = getProjectJsonPath(projectId);
    if (!fs.existsSync(jsonPath)) return null;
    try {
        const json = fs.readFileSync(jsonPath, 'utf-8');
        const data = normalizeProject(JSON.parse(json) as WolkProject);
        if (data && data.version === 2) return data;
        return null;
    } catch {
        return null;
    }
};

export const createProject = (initial?: { title?: string; audioSrc?: string; coverSrc?: string }): WolkProject => {
    const id = randomUUID();
    const now = Date.now();

    const project: WolkProject = {
        id,
        version: 2,
        song: {
            title: initial?.title ?? 'Untitled',
            audioSrc: initial?.audioSrc ?? '',
            coverSrc: initial?.coverSrc,
        },
        settings: { ...DEFAULT_PROJECT_SETTINGS },
        font: { ...DEFAULT_PROJECT_FONT },
        rawLyrics: '',
        lyricTracks: [],
        motionTracks: [],
        backgroundColor: '#000000',
        backgroundImageFit: 'cover',
        createdAt: now,
        updatedAt: now,
    };

    const dir = getProjectDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getProjectJsonPath(id), JSON.stringify(project, null, 2), 'utf-8');
    return project;
};

export const saveProject = (project: WolkProject): WolkProject => {
    if (!project || !project.id) {
        throw new Error('Invalid project: missing id');
    }

    const existing = loadProject(project.id);
    const now = Date.now();

    const toSave: WolkProject = normalizeProject({
        ...existing,
        ...project,
        version: 2,
        updatedAt: now,
        createdAt: existing?.createdAt ?? project.createdAt ?? now,
    });

    const dir = getProjectDir(project.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getProjectJsonPath(project.id), JSON.stringify(toSave, null, 2), 'utf-8');
    return toSave;
};

export const deleteProject = (projectId: string): boolean => {
    try {
        if (!projectId) return false;

        const projectDir = getProjectDir(projectId);
        const root = getProjectsRoot();
        if (!projectDir.startsWith(root)) {
            console.error('Security: Attempted to delete directory outside projects root');
            return false;
        }

        if (!fs.existsSync(projectDir)) return false;

        fs.rmSync(projectDir, { recursive: true, force: true });
        return true;
    } catch (error) {
        console.error('Failed to delete project:', error);
        return false;
    }
};

export const saveProjectAudio = (projectId: string, fileData: ArrayBuffer, originalFileName: string): WolkProject => {
    const dir = getProjectDir(projectId);
    fs.mkdirSync(dir, { recursive: true });

    const existing = loadProject(projectId);
    if (!existing) throw new Error('Project not found');

    if (existing.song.audioSrc) {
        try {
            const prevFile = existing.song.audioSrc.replace(`wolk://${projectId}/`, '');
            if (prevFile) {
                const prevPath = path.join(dir, prevFile);
                if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
            }
        } catch {}
    }

    const ext = (path.extname(originalFileName) || '').toLowerCase();
    const targetPath = path.join(dir, `audio${ext}`);
    fs.writeFileSync(targetPath, Buffer.from(fileData));

    existing.song.audioSrc = `wolk://${projectId}/audio${ext}`;
    return saveProject(existing);
};

export const saveProjectCover = (projectId: string, fileData: ArrayBuffer, originalFileName: string): WolkProject => {
    const dir = getProjectDir(projectId);
    fs.mkdirSync(dir, { recursive: true });

    const existing = loadProject(projectId);
    if (!existing) throw new Error('Project not found');

    if (existing.song.coverSrc) {
        try {
            const prevFile = existing.song.coverSrc.replace(`wolk://${projectId}/`, '');
            if (prevFile) {
                const prevPath = path.join(dir, prevFile);
                if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
            }
        } catch {}
    }

    const ext = (path.extname(originalFileName) || '').toLowerCase();
    const targetPath = path.join(dir, `cover${ext}`);
    fs.writeFileSync(targetPath, Buffer.from(fileData));

    existing.song.coverSrc = `wolk://${projectId}/cover${ext}`;
    return saveProject(existing);
};

export const saveProjectAsset = (projectId: string, fileData: ArrayBuffer, originalFileName: string, preferredFileName?: string): { url: string; fileName: string } => {
    const dir = getProjectDir(projectId);
    const assetsDir = path.join(dir, 'assets');
    try { fs.mkdirSync(assetsDir, { recursive: true }); } catch {}

    const baseRequested = String(preferredFileName || originalFileName || 'asset').replace(/[^a-zA-Z0-9-_\.]/g, '_');
    const ext = path.extname(baseRequested) || path.extname(String(originalFileName || '')) || '';
    const baseNoExt = path.basename(baseRequested, ext) || 'asset';

    let candidate = `${baseNoExt}${ext}`;
    let targetPath = path.join(assetsDir, candidate);
    let counter = 1;
    while (fs.existsSync(targetPath)) {
        candidate = `${baseNoExt}_${counter}${ext}`;
        targetPath = path.join(assetsDir, candidate);
        counter++;
    }

    fs.writeFileSync(targetPath, Buffer.from(fileData));
    return { url: `wolk://${projectId}/assets/${path.basename(targetPath)}`, fileName: path.basename(targetPath) };
};
