import * as StorageTypes from '@/types/storage_types';
import fs from 'fs';
import { getSecureFilePath } from '../fileUtils';





export async function deleteFile(fileName: string, subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER): Promise<boolean> {
    const filePath = getSecureFilePath(fileName, subfolder);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File ${fileName} not found in ${subfolder}`);
    }

    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (error) {
        console.error('File deletion error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
    }
}