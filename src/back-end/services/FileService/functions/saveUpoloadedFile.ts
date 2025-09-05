import { getDocStoragePath, saveFileToDocStorage } from "@/back-end/internal-processes/internal-storage";
import * as StorageTypes from '@/types/storage_types';
import path from 'path';

import * as FileUtils from '../fileUtils';



export async function saveUploadedFile(request: StorageTypes.FileUploadRequest): Promise<StorageTypes.FileResponse> {
    const { fileData, fileName, subfolder = StorageTypes.DOCUMENT_STORAGE_FOLDER.UNPROCESSED } = request;

    if (!fileData || !fileName) {
        throw new Error('File data and fileName are required');
    }

    try {
        // Save to internal storage
        const savedFileName = await saveFileToDocStorage(fileData, fileName, subfolder);
        const filePath = path.join(getDocStoragePath(subfolder), savedFileName);

        return {
            fileName: savedFileName,
            filePath,
            fileSize: fileData.byteLength,
            subfolder,
            metadata: {
                uploadedAt: Date.now(),
                fileHash: FileUtils.generateSimpleHash(Buffer.from(fileData))
            }
        };
    } catch (error) {
        console.error('File upload error:', error);
        throw new Error(`Failed to save uploaded file: ${error.message}`);
    }
}