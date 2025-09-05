
import { getDocStoragePath } from '@/back-end/internal-processes/internal-storage';
import * as StorageTypes from '@/types/storage_types';
import path from 'path';
import fs from 'fs';
import * as FileUtils from '../fileUtils';



/**
   * List files and folders with navigation support
   */
export async function listFilesAndFolders(
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER,
    relativePath: string = ''
): Promise<StorageTypes.DirectoryListing> {
    const baseFolderPath = getDocStoragePath(subfolder);
    const currentFolderPath = path.join(baseFolderPath, relativePath);

    // Security check: ensure we're not going outside the base folder
    const resolvedCurrentPath = path.resolve(currentFolderPath);
    const resolvedBasePath = path.resolve(baseFolderPath);
    if (!resolvedCurrentPath.startsWith(resolvedBasePath)) {
        throw new Error('Invalid path: Cannot navigate outside subfolder');
    }

    if (!fs.existsSync(currentFolderPath)) {
        throw new Error(`Path does not exist: ${relativePath}`);
    }

    try {
        const items = fs.readdirSync(currentFolderPath);

        const fileSystemItems: StorageTypes.FileSystemItem[] = items.map(itemName => {
            const itemPath = path.join(currentFolderPath, itemName);
            const stats = fs.statSync(itemPath);
            const relativeItemPath = path.join(relativePath, itemName);

            const item: StorageTypes.FileSystemItem = {
                name: itemName,
                path: relativeItemPath,
                isDirectory: stats.isDirectory(),
                size: stats.isDirectory() ? 0 : stats.size,
                modifiedAt: stats.mtime.getTime()
            };

            if (!stats.isDirectory()) {
                item.extension = path.extname(itemName).toLowerCase();
                item.mimeType = FileUtils.getMimeType(item.extension);
            }

            return item;
        });

        // Sort: directories first, then files, both alphabetically
        fileSystemItems.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        // Calculate parent path
        const parentPath = relativePath === '' ? null : path.dirname(relativePath);
        const normalizedParentPath = parentPath === '.' ? '' : parentPath;

        return {
            currentPath: relativePath,
            parentPath: normalizedParentPath,
            items: fileSystemItems,
            totalItems: fileSystemItems.length,
            subfolder
        };
    } catch (error) {
        console.error('Error listing files and folders:', error);
        throw new Error(`Failed to list directory contents: ${error.message}`);
    }
}