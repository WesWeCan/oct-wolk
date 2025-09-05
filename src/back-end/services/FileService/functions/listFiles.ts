import * as StorageTypes from '@/types/storage_types';
import fs from 'fs';
import path from 'path';
import { getDocStoragePath } from '@/back-end/internal-processes/internal-storage';


export async function listFiles(subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER): Promise<StorageTypes.FileInfo[]> {
    const folderPath = getDocStoragePath(subfolder);

    if (!fs.existsSync(folderPath)) {
        throw new Error(`Folder ${subfolder} not found`);
    }

    try {
        const files = fs.readdirSync(folderPath);

        return files.map(fileName => {
            const filePath = path.join(folderPath, fileName);
            const stats = fs.statSync(filePath);

            return {
                fileName,
                filePath,
                fileSize: stats.size,
                subfolder,
                modifiedAt: stats.mtime.getTime(),
                extension: path.extname(fileName).toLowerCase()
            };
        });
    } catch (error) {
        console.error('Error listing files:', error);
        throw new Error(`Failed to list files: ${error.message}`);
    }
}