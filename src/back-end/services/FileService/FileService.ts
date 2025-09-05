
import * as StorageTypes from '../../../types/storage_types';

import { downloadFromUrl } from './functions/downloadFromUrl';
import * as FileUtils from './fileUtils';
import { saveUploadedFile } from './functions/saveUpoloadedFile';
import { moveToProcessed } from './functions/moveFile';
import { moveToUnprocessed } from './functions/moveFile';
import { listFiles } from './functions/listFiles';
import { listFilesAndFolders } from './functions/listFilesAndFolders';
import { deleteFile } from './functions/deleteFile';
import { getFileInfo } from './functions/getFileInfo';
import { getContents } from './functions/getContents';

export class FileService {

  /**
   * Exposed file utility functions for advanced file operations.
   * 
   * This static property provides access to a collection of helper methods
   * for file manipulation, such as generating file hashes, determining MIME types,
   * sanitizing file names, and other low-level file system utilities.
   * 
   * These utilities are intended for use by consumers of the FileService who need
   * to perform additional file-related tasks beyond the standard CRUD operations
   * provided by the service methods.
   */
  static readonly utils: typeof FileUtils = FileUtils;

  /**
   * Downloads a file from a URL and saves it to the specified subfolder.
   * 
   * This method accepts a FileDownloadRequest object containing the URL of the file to download,
   * the desired file name, and the subfolder where the file should be saved.
   * 
   * @param request - The FileDownloadRequest object containing the URL, file name, and subfolder.
   * @returns A FileResponse object containing the file information.
   */
  static async downloadFromUrl(
    request: StorageTypes.FileDownloadRequest
  ): Promise<StorageTypes.FileResponse> {
    try {
      return downloadFromUrl(request);
    } catch (error) {
      return null;
    }
  }

  /**
   * Saves an uploaded file to the specified subfolder.
   * 
   * This method accepts a FileUploadRequest object containing the file data,
   * the desired file name, and the subfolder where the file should be saved.
   * 
   * @param request - The FileUploadRequest object containing the file data, file name, and subfolder.
   * @returns A FileResponse object containing the file information.
   */
  static async saveUploadedFile(
    request: StorageTypes.FileUploadRequest
  ): Promise<StorageTypes.FileResponse> {
    try {
      return saveUploadedFile(request);
    } catch (error) {
      return null;
    }
  }

  /**
   * Moves a file to the processed subfolder.
   * 
   * @param fileName - The name of the file to move.
   * @returns A FileResponse object containing the file information.
   */
  static async moveToProcessed(
    fileName: string
  ): Promise<StorageTypes.FileResponse> {
    try {
      return moveToProcessed(fileName);
    } catch (error) {
      return null;
    }
  }

  /**
   * Moves a file to the unprocessed subfolder.
   * 
   * @param fileName - The name of the file to move.
   * @returns A FileResponse object containing the file information.
   */
  static async moveToUnprocessed(
    fileName: string
  ): Promise<StorageTypes.FileResponse> {
    try {
      return moveToUnprocessed(fileName);
    } catch (error) {
      return null;
    }
  }

  /**
   * Lists files in the specified subfolder.
   * 
   * @param subfolder - The subfolder to list files from.
   * @returns An array of FileInfo objects.
   */
  static async listFiles(
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER
  ): Promise<StorageTypes.FileInfo[]> {
    try {
      return listFiles(subfolder);
    } catch (error) {
      return [];
    }
  }

  /**
   * Lists files and folders in the specified subfolder and relative path.
   * 
   * @param subfolder - The subfolder to list from.
   * @param relativePath - The relative path within the subfolder.
   * @returns A DirectoryListing object.
   */
  static async listFilesAndFolders(
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER,
    relativePath: string = ''
  ): Promise<StorageTypes.DirectoryListing> {
    try {
      return listFilesAndFolders(subfolder, relativePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Deletes a file from the specified subfolder.
   * 
   * @param fileName - The name of the file to delete.
   * @param subfolder - The subfolder containing the file.
   * @returns True if the file was deleted, false otherwise.
   */
  static async deleteFile(
    fileName: string,
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER
  ): Promise<boolean> {
    try {
      return deleteFile(fileName, subfolder);
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets information about a file in the specified subfolder.
   * 
   * @param fileName - The name of the file.
   * @param subfolder - The subfolder containing the file.
   * @returns A FileInfo object or null if not found.
   */
  static async getFileInfo(
    fileName: string,
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER
  ): Promise<StorageTypes.FileInfo | null> {
    try {
      return getFileInfo(fileName, subfolder);
    } catch (error) {
      return null;
    }
  }


  /**
   * Checks if a file exists in the specified subfolder.
   * 
   * @param fileName - The name of the file.
   * @param subfolder - The subfolder containing the file.
   * @returns True if the file exists, false otherwise.
   */
  static async fileExists(
    fileName: string,
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER
  ): Promise<boolean> {


    try {
      return getFileInfo(fileName, subfolder) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the contents of a file in the specified subfolder.
   * 
   * @param fileName - The name of the file.
   * @param subfolder - The subfolder containing the file.
   * @returns The contents of the file or null if not found.
   */
  static async getContents(
    fileName: string,
    subfolder: StorageTypes.DOCUMENT_STORAGE_FOLDER
  ): Promise<string | null> {
    try {
      return getContents(fileName, subfolder);
    } catch (error) {
      return null;
    }
  }
}