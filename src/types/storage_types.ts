export enum DOCUMENT_STORAGE_FOLDER {
    SONGS = 'songs',
    EXPORTS = 'exports'
}


export interface FileDownloadRequest {
    url: string;
    fileName?: string;
    subfolder?: DOCUMENT_STORAGE_FOLDER; 
  }
  
  export interface FileUploadRequest {
    fileData: ArrayBuffer;
    fileName: string;
    subfolder?: DOCUMENT_STORAGE_FOLDER;
  }
  
  export interface FileResponse {
    fileName: string;
    filePath: string;
    fileSize: number;
    subfolder: DOCUMENT_STORAGE_FOLDER;
    metadata: {
      originalUrl?: string;
      mimeType?: string;
      uploadedAt: number;
      fileHash?: string;
    };
  }
  
  export interface FileInfo {
    fileName: string;
    filePath: string;
    fileSize: number;
    subfolder: DOCUMENT_STORAGE_FOLDER;
    modifiedAt: number;
    extension: string;
  }
  
  export interface FileSystemItem {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: number;
    extension?: string;
    mimeType?: string;
  }
  
  export interface DirectoryListing {
    currentPath: string;
    parentPath: string | null;
    items: FileSystemItem[];
    totalItems: number;
    subfolder: DOCUMENT_STORAGE_FOLDER;
  }
  