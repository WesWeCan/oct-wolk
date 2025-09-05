import axios from 'axios';
import https from 'https';
import path from 'path';
import * as StorageTypes from '@/types/storage_types';

import * as FileUtils from '../fileUtils';
import { getDocStoragePath, saveFileToDocStorage } from '@/back-end/internal-processes/internal-storage';


export async function downloadFromUrl(request: StorageTypes.FileDownloadRequest): Promise<StorageTypes.FileResponse> {
  const { url, fileName, subfolder = StorageTypes.DOCUMENT_STORAGE_FOLDER.UNPROCESSED } = request;

  if (!url) {
    throw new Error('URL is required for file download');
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    throw new Error('Invalid URL provided');
  }

  try {
    // Create HTTPS agent that handles SSL certificate issues
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Allow self-signed certificates, introduces more security risks
      secureProtocol: 'TLSv1_2_method' // Use TLS 1.2 for better compatibility
    });

    // Download the file using axios with custom agent
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      httpsAgent: url.startsWith('https:') ? httpsAgent : undefined,
      timeout: FileUtils.FILE_CONSTANTS.DOWNLOAD_TIMEOUT
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download file: HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = response.data;

    if (arrayBuffer.byteLength > FileUtils.FILE_CONSTANTS.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${arrayBuffer.byteLength} bytes exceeds maximum of ${FileUtils.FILE_CONSTANTS.MAX_FILE_SIZE} bytes`);
    }

    let userGeneratedFileName: string | null = fileName;
    // check if the filename has the same extension as the url
    if (fileName) {
      const extension = path.extname(fileName);
      const urlExtension = path.extname(url);
      if (extension !== urlExtension) {
        userGeneratedFileName = fileName + urlExtension;
      }
    }

    // Determine filename
    const finalFileName = userGeneratedFileName || FileUtils.extractFileNameFromUrl(url) || `download_${Date.now()}`;


    // Save to internal storage
    const savedFileName = await saveFileToDocStorage(arrayBuffer, finalFileName, subfolder);
    const filePath = path.join(getDocStoragePath(subfolder), savedFileName);

    return {
      fileName: savedFileName,
      filePath,
      fileSize: arrayBuffer.byteLength,
      subfolder,
      metadata: {
        originalUrl: url,
        mimeType: response.headers['content-type'] || undefined,
        uploadedAt: Date.now(),
        fileHash: FileUtils.generateSimpleHash(Buffer.from(arrayBuffer))
      }
    };
  } catch (error) {
    console.error('File download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}