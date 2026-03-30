import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import {
    copyDirectoryContents,
    createTempDir,
    createZipArchive,
    extractZipArchive,
    listFilesRecursive,
    removeDirIfExists,
} from './archive-utils';
import { getProjectDir, loadProject, normalizeProject, saveProject } from './project-storage';
import type { WolkProject } from '@/types/project_types';
import {
    WOLK_PROJECT_ARCHIVE_VERSION,
    type WolkProjectArchiveManifest,
} from '@/types/archive_types';

const PROJECT_MANIFEST_PATH = 'manifest.json';
const PROJECT_JSON_PATH = 'project/project.json';
const PROJECT_FILES_ROOT = 'project/files';

const sanitizeBaseName = (input: string, fallback: string): string => {
    const normalized = String(input || '').trim().replace(/[^a-zA-Z0-9-_\.]+/g, '_').replace(/^_+|_+$/g, '');
    return normalized || fallback;
};

const makeManifest = (project: WolkProject): WolkProjectArchiveManifest => ({
    fileType: 'wolk-project',
    schemaVersion: WOLK_PROJECT_ARCHIVE_VERSION,
    exportedAt: Date.now(),
    appVersion: app.getVersion(),
    projectVersion: project.version,
});

const rewriteProjectIds = (project: WolkProject, nextId: string): WolkProject => {
    const previousId = String(project?.id || '').trim();
    if (!previousId) {
        throw new Error('Imported project is missing an id.');
    }

    const serialized = JSON.stringify(project);
    const rewritten = serialized.split(`wolk://${previousId}/`).join(`wolk://${nextId}/`);
    const parsed = JSON.parse(rewritten) as WolkProject;
    return {
        ...parsed,
        id: nextId,
    };
};

export const getProjectArchiveSuggestedFileName = (project: WolkProject): string => {
    return `${sanitizeBaseName(project.song.title || project.id, 'project')}.wolk`;
};

export const exportProjectArchive = async (projectId: string, outputPath: string): Promise<WolkProject> => {
    const project = loadProject(projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    const projectDir = getProjectDir(projectId);
    if (!fs.existsSync(projectDir)) {
        throw new Error('Project directory not found');
    }

    const entries = [
        {
            archivePath: PROJECT_MANIFEST_PATH,
            data: JSON.stringify(makeManifest(project), null, 2),
        },
        {
            archivePath: PROJECT_JSON_PATH,
            data: JSON.stringify(project, null, 2),
        },
    ];

    for (const filePath of listFilesRecursive(projectDir)) {
        const relativePath = path.relative(projectDir, filePath);
        if (relativePath === 'project.json') continue;
        entries.push({
            archivePath: path.posix.join(PROJECT_FILES_ROOT, relativePath.replace(/\\/g, '/')),
            sourcePath: filePath,
        });
    }

    await createZipArchive(outputPath, entries);
    return project;
};

const readImportedProject = (extractDir: string): WolkProject => {
    const manifestPath = path.join(extractDir, PROJECT_MANIFEST_PATH);
    const projectJsonPath = path.join(extractDir, PROJECT_JSON_PATH);

    if (!fs.existsSync(manifestPath) || !fs.existsSync(projectJsonPath)) {
        throw new Error('Archive is missing required project files.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as WolkProjectArchiveManifest;
    if (manifest.fileType !== 'wolk-project' || manifest.schemaVersion !== WOLK_PROJECT_ARCHIVE_VERSION) {
        throw new Error('Unsupported .wolk archive version.');
    }

    const rawProject = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8')) as WolkProject;
    return normalizeProject(rawProject);
};

export const importProjectArchiveFromPath = async (archivePath: string): Promise<WolkProject> => {
    const extractDir = createTempDir('wolk-import');

    try {
        await extractZipArchive(archivePath, extractDir);
        const importedProject = readImportedProject(extractDir);
        const nextId = randomUUID();
        const rewrittenProject = rewriteProjectIds(importedProject, nextId);
        const targetDir = getProjectDir(nextId);
        const extractedFilesDir = path.join(extractDir, PROJECT_FILES_ROOT);

        if (fs.existsSync(extractedFilesDir)) {
            copyDirectoryContents(extractedFilesDir, targetDir);
        } else {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        return saveProject({
            ...rewrittenProject,
            id: nextId,
        });
    } finally {
        removeDirIfExists(extractDir);
    }
};

export const importProjectArchiveFromBytes = async (fileName: string, fileData: ArrayBuffer): Promise<WolkProject> => {
    const tempDir = createTempDir('wolk-import-bytes');
    const tempArchivePath = path.join(tempDir, sanitizeBaseName(fileName || 'import', 'imported-project'));

    try {
        fs.writeFileSync(tempArchivePath, Buffer.from(fileData));
        return await importProjectArchiveFromPath(tempArchivePath);
    } finally {
        removeDirIfExists(tempDir);
    }
};
