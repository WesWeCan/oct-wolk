import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';

const STORAGE_SUBFOLDERS = [
    DOCUMENT_STORAGE_FOLDER.SONGS,
    DOCUMENT_STORAGE_FOLDER.EXPORTS,
    DOCUMENT_STORAGE_FOLDER.PRESETS,
] as const;

const getUserDataStoragePath = () => {
    return path.join(app.getPath('userData'), 'wolk');
}

const getLegacyDocumentsStoragePath = () => {
    return path.join(app.getPath('documents'), '__oct_files', 'wolk');
}

const directoryHasEntries = (directoryPath: string) => {
    return fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length > 0;
}

const storageHasUserData = (storagePath: string) => {
    if (!fs.existsSync(storagePath)) {
        return false;
    }

    const entries = fs.readdirSync(storagePath, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = path.join(storagePath, entry.name);

        if (!entry.isDirectory()) {
            return true;
        }

        if (entry.name === 'docStorage') {
            for (const subfolder of STORAGE_SUBFOLDERS) {
                if (directoryHasEntries(path.join(entryPath, subfolder))) {
                    return true;
                }
            }
            continue;
        }

        if (STORAGE_SUBFOLDERS.includes(entry.name as DOCUMENT_STORAGE_FOLDER)) {
            if (directoryHasEntries(entryPath)) {
                return true;
            }
            continue;
        }

        return true;
    }

    return false;
}

const copyRecursive = (sourcePath: string, destinationPath: string) => {
    if (!fs.existsSync(sourcePath)) return;

    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
        fs.mkdirSync(destinationPath, { recursive: true });
        const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
        for (const entry of entries) {
            copyRecursive(
                path.join(sourcePath, entry.name),
                path.join(destinationPath, entry.name),
            );
        }
        return;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
}

const moveStorageContents = (sourceBasePath: string, destinationBasePath: string) => {
    fs.mkdirSync(destinationBasePath, { recursive: true });

    for (const subfolder of STORAGE_SUBFOLDERS) {
        const legacySubfolderPath = path.join(sourceBasePath, 'docStorage', subfolder);
        const flatSubfolderPath = path.join(sourceBasePath, subfolder);

        if (directoryHasEntries(legacySubfolderPath)) {
            copyRecursive(legacySubfolderPath, path.join(destinationBasePath, subfolder));
        }

        if (directoryHasEntries(flatSubfolderPath)) {
            copyRecursive(flatSubfolderPath, path.join(destinationBasePath, subfolder));
        }
    }

    const entries = fs.readdirSync(sourceBasePath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'docStorage') {
            continue;
        }

        if (STORAGE_SUBFOLDERS.includes(entry.name as DOCUMENT_STORAGE_FOLDER)) {
            continue;
        }

        copyRecursive(
            path.join(sourceBasePath, entry.name),
            path.join(destinationBasePath, entry.name),
        );
    }

    fs.rmSync(sourceBasePath, { recursive: true, force: true });
}

const migrateStorageIfNeeded = async () => {
    const destinationBasePath = getInternalStoragePath();
    if (storageHasUserData(destinationBasePath)) {
        console.log('Documents storage already has data, skipping migration');
        return;
    }

    const migrationSources = [
        {
            label: 'Application Support storage',
            sourcePath: getUserDataStoragePath(),
        },
        {
            label: 'legacy Documents storage',
            sourcePath: getLegacyDocumentsStoragePath(),
        },
    ];

    for (const { label, sourcePath } of migrationSources) {
        if (path.resolve(sourcePath) === path.resolve(destinationBasePath)) {
            continue;
        }

        if (!storageHasUserData(sourcePath)) {
            continue;
        }

        try {
            console.log(`Migrating data from ${label}...`);
            console.log('Old path:', sourcePath);
            console.log('New path:', destinationBasePath);
            moveStorageContents(sourcePath, destinationBasePath);
            console.log('Migration completed successfully');
            return;
        } catch (error) {
            console.error(`Migration from ${label} failed:`, error);
            console.log('Continuing with storage initialization at new location');
            return;
        }
    }

    console.log('No old storage to migrate');
}

export const getInternalStoragePath = () => {
    return path.join(app.getPath('documents'), 'WOLK');
}

export const getInternalStorageFilePath = (fileName: string) => {
    return path.join(getInternalStoragePath(), fileName);
}

export const getInternalStorageFile = (fileName: string) => {
    const filePath = getInternalStorageFilePath(fileName);
    return fs.readFileSync(filePath);
}

export const openInternalStorageFolder = () => {
    shell.openPath(getInternalStoragePath());
}

export const initStorage = async () => {
    await migrateStorageIfNeeded();

    const storagePath = getInternalStoragePath();
    const songsPath = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
    const exportsPath = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.EXPORTS);
    const presetsPath = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.PRESETS);

    // Ensure storage folders exist
    fs.mkdirSync(storagePath, { recursive: true });
    fs.mkdirSync(songsPath, { recursive: true });
    fs.mkdirSync(exportsPath, { recursive: true });
    fs.mkdirSync(presetsPath, { recursive: true });

    console.log('Storage initialized:', {
        storage: storagePath,
        song: songsPath,
        export: exportsPath,
        presets: presetsPath,
    });

    return {
        storage: storagePath,
        song: songsPath,
        export: exportsPath,
        presets: presetsPath,
    };
}

export const getDocStoragePath = (subfolder: DOCUMENT_STORAGE_FOLDER) => {
    return path.join(getInternalStoragePath(), subfolder);
}

export const saveFileToDocStorage = async (fileData: ArrayBuffer, fileName: string, subfolder: DOCUMENT_STORAGE_FOLDER): Promise<string> => {
    // Sanitize the filename to prevent path traversal attacks
    const sanitizedFileName = sanitizeFileName(fileName, subfolder);
    const filePath = path.join(getDocStoragePath(subfolder), sanitizedFileName);

    // Additional security check: ensure the resolved path is within our storage directory
    const resolvedFilePath = path.resolve(filePath);
    const resolvedBasePath = path.resolve(getDocStoragePath(subfolder));
    
    if (!resolvedFilePath.startsWith(resolvedBasePath + path.sep) && resolvedFilePath !== resolvedBasePath) {
        throw new Error('Security violation: file path outside storage directory');
    }

    // Convert ArrayBuffer to Buffer before writing
    const buffer = Buffer.from(fileData);

    fs.writeFileSync(filePath, buffer);

    // Verify file integrity
    const originalSize = buffer.byteLength;
    const writtenSize = fs.statSync(filePath).size;

    if (originalSize !== writtenSize) {
        console.warn(`File size mismatch: original=${originalSize}, written=${writtenSize}`);
    }

    return sanitizedFileName;
};


/**
 * Sanitize filename to prevent path traversal attacks
 * @param fileName The filename to sanitize
 * @returns Safe filename without path traversal characters
 */
export const sanitizeFileName = (fileName: string, targetSubfolder: DOCUMENT_STORAGE_FOLDER): string => {
    if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid filename provided');
    }

    // Normalize the path and prevent absolute paths
    let sanitized = path.normalize(fileName);
    
    // Prevent absolute paths
    if (path.isAbsolute(sanitized)) {
        throw new Error('Invalid filename: absolute paths not allowed');
    }
    
    // Remove any upward traversal attempts
    if (sanitized.includes('..')) {
        throw new Error('Invalid filename: path traversal detected');
    }
    
    // Remove leading slashes/separators
    sanitized = sanitized.replace(/^[\/\\]+/, '');
    
    // Check for empty result
    if (sanitized.length === 0 || sanitized === '.' || sanitized === '..') {
        throw new Error('Invalid filename: empty or reserved name');
    }

    // Path resolution security check
    const resolvedFilePath = path.resolve(getDocStoragePath(targetSubfolder), sanitized);
    const resolvedBasePath = path.resolve(getDocStoragePath(targetSubfolder));

    if (!resolvedFilePath.startsWith(resolvedBasePath + path.sep) && resolvedFilePath !== resolvedBasePath) {
        throw new Error('Security violation: file path outside storage directory');
    }
    
    // Check for prohibited patterns in any part of the path
    const pathParts = sanitized.split(/[\/\\]/);
    for (const part of pathParts) {
        if (part.includes('..') || part === '.' || part === '..' || part.startsWith('.')) {
            throw new Error('Invalid filename: contains prohibited characters or hidden files');
        }
    }
    
    return sanitized;
};


/**
 * Returns true if `target` is inside `root` (or equals it).
 * Prevents path traversal by resolving both paths first.
 */
export const isPathInsideRoot = (target: string, root: string): boolean => {
    const resolvedTarget = path.resolve(target);
    const resolvedRoot = path.resolve(root);
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
};

export const moveFileInDocStorage = (fileName: string, fromSubfolder: DOCUMENT_STORAGE_FOLDER, toSubfolder: DOCUMENT_STORAGE_FOLDER): string => {

    if(fromSubfolder === toSubfolder) {
        throw new Error('Cannot move file to the same folder');
    }

    const sanitizedFileName = sanitizeFileName(fileName, toSubfolder);
    const sourcePath = path.join(getDocStoragePath(fromSubfolder), sanitizedFileName);
    const targetPath = path.join(getDocStoragePath(toSubfolder), sanitizedFileName);

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`File ${fileName} not found in ${fromSubfolder} folder`);
    }

    // Move the file
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);

    return sanitizedFileName;

}