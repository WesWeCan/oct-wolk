import { sanitizeFileName } from "@/back-end/internal-processes/internal-storage";
import * as StorageTypes from '@/types/storage_types';
import fs from 'fs';
import path from 'path';
import { getSecureFilePath } from '../fileUtils';



export async function getFileInfo(fileName: string, subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER): Promise<StorageTypes.FileInfo | null> {
    const filePath = getSecureFilePath(fileName, subfolder);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File ${fileName} not found in ${subfolder}`);
    }

    try {
        const stats = fs.statSync(filePath);
        const sanitizedFileName = sanitizeFileName(fileName, subfolder);

        return {
            fileName: sanitizedFileName,
            filePath,
            fileSize: stats.size,
            subfolder,
            modifiedAt: stats.mtime.getTime(),
            extension: path.extname(sanitizedFileName).toLowerCase()
        };
    } catch (error) {
        console.error('Error getting file info:', error);
        throw new Error(`Error getting file info: ${error}`);
    }
}