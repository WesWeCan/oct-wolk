import { sanitizeFileName } from "@/back-end/internal-processes/internal-storage";
import * as StorageTypes from '@/types/storage_types';
import fs from 'fs';
import path from 'path';
import { getSecureFilePath } from '../fileUtils';



export async function getContents(fileName: string, subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER): Promise<string | null> {
    const filePath = getSecureFilePath(fileName, subfolder);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File ${fileName} not found in ${subfolder}`);
    }

    try {
        const contents = fs.readFileSync(filePath, 'utf8');
        return contents;
    } catch (error) {
        console.error('Error getting file info:', error);
        throw new Error(`Error getting file info: ${error}`);
    }
}