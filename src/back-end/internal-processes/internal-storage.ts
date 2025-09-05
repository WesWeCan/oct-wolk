import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';


export const getInternalStoragePath = () => {
    return path.join(app.getPath('documents'), '__oct_files', 'wolk');
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
    const storagePath = getInternalStoragePath();
    const songsPath = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
    const exportsPath = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.EXPORTS);

    // Ensure storage folders exist
    fs.mkdirSync(storagePath, { recursive: true });
    fs.mkdirSync(songsPath, { recursive: true });
    fs.mkdirSync(exportsPath, { recursive: true });

    console.log('Storage initialized:', {
        storage: storagePath,
        song: songsPath,
        export: exportsPath
    });

    return {
        storage: storagePath,
        song: songsPath,
        export: exportsPath
    };
}

export const getDocStoragePath = (subfolder: DOCUMENT_STORAGE_FOLDER) => {
    return path.join(getInternalStoragePath(), 'docStorage', subfolder);
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