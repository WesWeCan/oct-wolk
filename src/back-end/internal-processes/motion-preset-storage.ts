import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDocStoragePath, isPathInsideRoot, sanitizeFileName } from './internal-storage';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';
import type { MotionPresetDocument, MotionPresetSaveInput, MotionPresetSummary } from '@/types/motion_preset_types';

const getMotionPresetsRoot = (): string => getDocStoragePath(DOCUMENT_STORAGE_FOLDER.PRESETS);

const sanitizeBlockType = (blockType: string): string => {
    const trimmed = String(blockType || '').trim();
    if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        throw new Error('Invalid preset block type');
    }
    return trimmed;
};

const sanitizePresetId = (presetId: string): string => {
    const trimmed = String(presetId || '').trim();
    if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        throw new Error('Invalid preset id');
    }
    return trimmed;
};

const getPresetTypeDir = (blockType: string): string => {
    const safeBlockType = sanitizeBlockType(blockType);
    const dirPath = path.join(getMotionPresetsRoot(), safeBlockType);

    if (!isPathInsideRoot(dirPath, getMotionPresetsRoot())) {
        throw new Error('Invalid preset directory');
    }

    return dirPath;
};

const getPresetFilePath = (blockType: string, presetId: string): string => {
    const safeId = sanitizePresetId(presetId);
    const relativeFilePath = path.join(sanitizeBlockType(blockType), `${safeId}.json`);
    const sanitizedRelativePath = sanitizeFileName(relativeFilePath, DOCUMENT_STORAGE_FOLDER.PRESETS);
    const filePath = path.join(getMotionPresetsRoot(), sanitizedRelativePath);

    if (!isPathInsideRoot(filePath, getMotionPresetsRoot())) {
        throw new Error('Invalid preset file path');
    }

    return filePath;
};

const normalizePresetDocument = (raw: MotionPresetDocument): MotionPresetDocument => {
    const id = sanitizePresetId(String(raw?.id || randomUUID()));
    const blockType = sanitizeBlockType(String(raw?.blockType || ''));
    const name = String(raw?.name || '').trim();

    if (!name) {
        throw new Error('Preset name is required');
    }

    const version = Math.max(1, Math.round(Number(raw?.version) || 1));
    const createdAt = Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : Date.now();
    const updatedAt = Number.isFinite(Number(raw?.updatedAt)) ? Number(raw.updatedAt) : Date.now();

    return {
        id,
        blockType,
        version,
        name,
        createdAt,
        updatedAt,
        payload: raw?.payload ?? {},
    };
};

const toSummary = (document: MotionPresetDocument): MotionPresetSummary => ({
    id: document.id,
    blockType: document.blockType,
    version: document.version,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
});

export const listMotionPresets = (blockType: string): MotionPresetSummary[] => {
    const presetDir = getPresetTypeDir(blockType);
    if (!fs.existsSync(presetDir)) return [];

    const entries = fs.readdirSync(presetDir, { withFileTypes: true });
    const summaries: MotionPresetSummary[] = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

        try {
            const filePath = path.join(presetDir, entry.name);
            const document = normalizePresetDocument(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MotionPresetDocument);
            if (document.blockType !== blockType) continue;
            summaries.push(toSummary(document));
        } catch {
            // Skip broken preset files so one bad doc does not kill the list.
        }
    }

    summaries.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
    return summaries;
};

export const loadMotionPreset = (blockType: string, presetId: string): MotionPresetDocument | null => {
    const filePath = getPresetFilePath(blockType, presetId);
    if (!fs.existsSync(filePath)) return null;

    const document = normalizePresetDocument(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MotionPresetDocument);
    if (document.blockType !== sanitizeBlockType(blockType)) {
        throw new Error('Preset block type mismatch');
    }
    return document;
};

export const saveMotionPreset = (input: MotionPresetSaveInput): MotionPresetDocument => {
    const blockType = sanitizeBlockType(input.blockType);
    const presetDir = getPresetTypeDir(blockType);
    fs.mkdirSync(presetDir, { recursive: true });

    const existing = input.id ? loadMotionPreset(blockType, input.id) : null;
    const now = Date.now();
    const document = normalizePresetDocument({
        id: input.id || randomUUID(),
        blockType,
        version: input.version,
        name: input.name,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        payload: input.payload,
    });

    const filePath = getPresetFilePath(blockType, document.id);
    fs.writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');
    return document;
};

export const deleteMotionPreset = (blockType: string, presetId: string): boolean => {
    try {
        const filePath = getPresetFilePath(blockType, presetId);
        if (!fs.existsSync(filePath)) return false;
        fs.unlinkSync(filePath);
        return true;
    } catch {
        return false;
    }
};
