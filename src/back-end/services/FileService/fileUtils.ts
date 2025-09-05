import crypto from 'crypto';
import { getDocStoragePath, sanitizeFileName } from "@/back-end/internal-processes/internal-storage";
import * as StorageTypes from '@/types/storage_types';
import path from 'path';

// Add constants
export const FILE_CONSTANTS = {
  DOWNLOAD_TIMEOUT: 30000,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
} as const;

/**
 * Get the secure file path for a file, ensuring that the file is not outside the storage directory
 * 
 * @param fileName - The name of the file to get the secure file path for
 * @param subfolder - The subfolder to save the file to
 * @returns The secure file path
 */
export function getSecureFilePath(fileName: string, subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER): string {

    const sanitizedFileName = sanitizeFileName(fileName, subfolder);
    const basePath = getDocStoragePath(subfolder);
    const filePath = path.join(basePath, sanitizedFileName);


    // Check if resolves
    const resolvedFilePath = path.resolve(filePath);
    const resolvedBasePath = path.resolve(basePath);

    if (!resolvedFilePath.startsWith(resolvedBasePath + path.sep) && resolvedFilePath !== resolvedBasePath) {
        throw new Error('Security violation: file path outside storage directory');
    }

    return filePath;
}


/**
 * Extract filename from URL
 * 
 * @param url - The URL to extract the filename from
 * @returns The filename or null if no filename is found
 */
export function extractFileNameFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const segments = pathname.split('/');
        const lastSegment = segments[segments.length - 1];

        // Check if last segment looks like a filename
        if (lastSegment && lastSegment.includes('.')) {
            return lastSegment;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Generate a simple hash of a buffer
 * 
 * @param buffer - The buffer to generate a hash of
 * @returns The hash of the buffer
 */
export function generateSimpleHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}


/**
 * Get the MIME type for a file extension
 * 
 * @param extension - The file extension to get the MIME type for
 * @returns The MIME type
 */
export function getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.rtf': 'application/rtf',

      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',

      // Web
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',

      // Archives
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',

      // Audio/Video
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',

      // Other
      '.csv': 'text/csv',
      '.log': 'text/plain'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }


  export function validateFileType(fileName: string, allowedExtensions: string[]): boolean {
    const extension = path.extname(fileName).toLowerCase();
    return allowedExtensions.includes(extension);
  }