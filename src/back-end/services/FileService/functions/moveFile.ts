
import * as StorageTypes from '@/types/storage_types';
import fs from 'fs';
import path from 'path';
import { getDocStoragePath } from '@/back-end/internal-processes/internal-storage';
import { moveFileInDocStorage } from '@/back-end/internal-processes/internal-storage';

// moveToProcessed.ts
export async function moveToProcessed(fileName: string): Promise<StorageTypes.FileResponse> {
    const sanitizedFileName = moveFileInDocStorage(fileName, StorageTypes.DOCUMENT_STORAGE_FOLDER.UNPROCESSED, StorageTypes.DOCUMENT_STORAGE_FOLDER.PROCESSED);
    const filePath = path.join(getDocStoragePath(StorageTypes.DOCUMENT_STORAGE_FOLDER.PROCESSED), sanitizedFileName);
    const stats = fs.statSync(filePath);

    return {
        fileName: sanitizedFileName,
        filePath,
        fileSize: stats.size,
        subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER.PROCESSED,
        metadata: {
            uploadedAt: Date.now()
        }
    };
}

// moveToUnprocessed.ts  
export async function moveToUnprocessed(fileName: string): Promise<StorageTypes.FileResponse> {
    const sanitizedFileName = moveFileInDocStorage(fileName, StorageTypes.DOCUMENT_STORAGE_FOLDER.PROCESSED, StorageTypes.DOCUMENT_STORAGE_FOLDER.UNPROCESSED);
    const filePath = path.join(getDocStoragePath(StorageTypes.DOCUMENT_STORAGE_FOLDER.UNPROCESSED), sanitizedFileName);
    const stats = fs.statSync(filePath);

    return {
        fileName: sanitizedFileName,
        filePath,
        fileSize: stats.size,
        subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER.UNPROCESSED,
        metadata: {
            uploadedAt: Date.now()
        }
    };
}