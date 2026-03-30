import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
    createTempDir,
    createZipArchive,
    extractZipArchive,
    removeDirIfExists,
} from './archive-utils';
import {
    listAllMotionPresetDocuments,
    loadMotionPreset,
    normalizePresetDocument,
    saveMotionPreset,
} from './motion-preset-storage';
import type { MotionPresetDocument, MotionPresetSummary } from '@/types/motion_preset_types';
import {
    WOLK_PRESET_ARCHIVE_VERSION,
    WOLK_PRESET_BUNDLE_ARCHIVE_VERSION,
    type MotionPresetArchiveManifest,
    type MotionPresetBundleArchiveManifest,
    type SupportedArchiveManifest,
} from '@/types/archive_types';

const MANIFEST_PATH = 'manifest.json';
const SINGLE_PRESET_PATH = 'preset.json';
const BUNDLE_PRESETS_ROOT = 'presets';

const sanitizeBaseName = (input: string, fallback: string): string => {
    const normalized = String(input || '').trim().replace(/[^a-zA-Z0-9-_\.]+/g, '_').replace(/^_+|_+$/g, '');
    return normalized || fallback;
};

const toSummary = (document: MotionPresetDocument): MotionPresetSummary => ({
    id: document.id,
    blockType: document.blockType,
    version: document.version,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
});

const saveImportedPreset = (document: MotionPresetDocument): MotionPresetSummary => {
    const normalized = normalizePresetDocument(document);
    const saved = saveMotionPreset({
        blockType: normalized.blockType,
        version: normalized.version,
        name: normalized.name,
        payload: normalized.payload,
    });
    return toSummary(saved);
};

const readManifest = (extractDir: string): SupportedArchiveManifest => {
    const manifestPath = path.join(extractDir, MANIFEST_PATH);
    if (!fs.existsSync(manifestPath)) {
        throw new Error('Archive is missing a manifest.');
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SupportedArchiveManifest;
};

export const getMotionPresetArchiveSuggestedFileName = (document: MotionPresetDocument): string => {
    return `${sanitizeBaseName(document.name || document.id, 'motion-preset')}.wolkdpreset`;
};

export const getMotionPresetBundleSuggestedFileName = (): string => 'wolk-motion-presets.wolkpresets';

export const exportMotionPresetArchive = async (blockType: string, presetId: string, outputPath: string): Promise<MotionPresetDocument> => {
    const document = loadMotionPreset(blockType, presetId);
    if (!document) {
        throw new Error('Preset not found');
    }

    const manifest: MotionPresetArchiveManifest = {
        fileType: 'motion-preset',
        schemaVersion: WOLK_PRESET_ARCHIVE_VERSION,
        exportedAt: Date.now(),
        appVersion: app.getVersion(),
        blockType: document.blockType,
        presetVersion: document.version,
    };

    await createZipArchive(outputPath, [
        { archivePath: MANIFEST_PATH, data: JSON.stringify(manifest, null, 2) },
        { archivePath: SINGLE_PRESET_PATH, data: JSON.stringify(document, null, 2) },
    ]);

    return document;
};

export const exportMotionPresetBundleArchive = async (outputPath: string): Promise<number> => {
    const documents = listAllMotionPresetDocuments();
    const manifest: MotionPresetBundleArchiveManifest = {
        fileType: 'motion-preset-bundle',
        schemaVersion: WOLK_PRESET_BUNDLE_ARCHIVE_VERSION,
        exportedAt: Date.now(),
        appVersion: app.getVersion(),
        presetCount: documents.length,
    };

    const entries = [
        { archivePath: MANIFEST_PATH, data: JSON.stringify(manifest, null, 2) },
    ];

    for (const document of documents) {
        entries.push({
            archivePath: path.posix.join(BUNDLE_PRESETS_ROOT, document.blockType, `${document.id}.json`),
            data: JSON.stringify(document, null, 2),
        });
    }

    await createZipArchive(outputPath, entries);
    return documents.length;
};

export const importMotionPresetArchiveFromPath = async (archivePath: string): Promise<MotionPresetSummary[]> => {
    const extractDir = createTempDir('wolk-presets-import');

    try {
        await extractZipArchive(archivePath, extractDir);
        const manifest = readManifest(extractDir);

        if (manifest.fileType === 'motion-preset') {
            if (manifest.schemaVersion !== WOLK_PRESET_ARCHIVE_VERSION) {
                throw new Error('Unsupported motion preset archive version.');
            }

            const presetPath = path.join(extractDir, SINGLE_PRESET_PATH);
            if (!fs.existsSync(presetPath)) {
                throw new Error('Archive is missing preset.json.');
            }

            const document = JSON.parse(fs.readFileSync(presetPath, 'utf-8')) as MotionPresetDocument;
            return [saveImportedPreset(document)];
        }

        if (manifest.fileType === 'motion-preset-bundle') {
            if (manifest.schemaVersion !== WOLK_PRESET_BUNDLE_ARCHIVE_VERSION) {
                throw new Error('Unsupported motion preset bundle version.');
            }

            const presetsRoot = path.join(extractDir, BUNDLE_PRESETS_ROOT);
            if (!fs.existsSync(presetsRoot)) {
                return [];
            }

            const imported: MotionPresetSummary[] = [];
            const blockTypes = fs.readdirSync(presetsRoot, { withFileTypes: true });
            for (const blockTypeEntry of blockTypes) {
                if (!blockTypeEntry.isDirectory()) continue;
                const blockTypeDir = path.join(presetsRoot, blockTypeEntry.name);
                const files = fs.readdirSync(blockTypeDir, { withFileTypes: true });
                for (const fileEntry of files) {
                    if (!fileEntry.isFile() || !fileEntry.name.endsWith('.json')) continue;
                    const document = JSON.parse(fs.readFileSync(path.join(blockTypeDir, fileEntry.name), 'utf-8')) as MotionPresetDocument;
                    imported.push(saveImportedPreset(document));
                }
            }
            return imported;
        }

        throw new Error('Unsupported preset archive type.');
    } finally {
        removeDirIfExists(extractDir);
    }
};
