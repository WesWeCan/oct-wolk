import { app, BrowserWindow, Menu, systemPreferences, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import { getInternalStoragePath, initStorage } from './back-end/internal-processes/internal-storage';
import { registerInternalProcesses } from './back-end/internal-processes/internal-processes';
import { buildApplicationMenuTemplate } from './back-end/application-menu';
import { openExternalHttpUrl } from './back-end/internal-processes/external-links';
import { MENU_COMMAND_CHANNEL, type ProjectEditorCommandId } from './shared/projectEditorCommands';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const sendProjectEditorMenuCommand = (commandId: ProjectEditorCommandId) => {
  const target = BrowserWindow.getFocusedWindow() || mainWindow;
  target?.webContents.send(MENU_COMMAND_CHANNEL, commandId);
};

const setApplicationMenu = () => {
  const menu = Menu.buildFromTemplate(buildApplicationMenuTemplate({
    applicationName: app.name,
    isMac: process.platform === 'darwin',
    sendProjectEditorCommand: sendProjectEditorMenuCommand,
    openExternalUrl: (url) => openExternalHttpUrl(url),
  }));

  Menu.setApplicationMenu(menu);
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

   // Open the DevTools.
   if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = null;
    }
  });

};

const askPermissions = async () => {
  systemPreferences.askForMediaAccess('microphone').then(result => {
    console.log('askForMediaAccess', result);
  });

  systemPreferences.askForMediaAccess('camera').then(result => {
    console.log('askForMediaAccess', result);
  });

  
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'wolk',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
      stream: true,
    }
  }
]) 

const setProtocols = async () => {

  /**
   * Custom protocol handler for wolk:// URLs.
   * 
   * CRITICAL: This handler supports HTTP Range requests, which are essential for:
   * - Audio/video seeking: When you scrub to a position in the timeline, the HTMLAudioElement
   *   or HTMLVideoElement sends a Range request (e.g., "Range: bytes=1000000-2000000") to
   *   fetch only the data needed for that position, rather than re-downloading the entire file.
   * - Memory efficiency: Large media files don't need to be fully loaded into memory.
   * - Fast seeking: The browser can jump to any position instantly without buffering the whole file.
   * 
   * Without Range support, setting currentTime on an audio/video element would be ignored,
   * causing playback to always start from position 0.
   * 
   * How Range requests work:
   * 1. Browser requests: "Range: bytes=5000000-6000000"
   * 2. Server responds with: "206 Partial Content" + the requested byte range
   * 3. Browser can now play from that position
   * 
   * This is standard HTTP behavior that browsers expect when working with media files.
   */
  protocol.handle('wolk', async (request) => {
    const fileName = decodeURIComponent(request.url.slice('wolk://'.length));
    const songsRoot = path.join(getInternalStoragePath(), 'docStorage', 'songs');
    const fullPath = path.resolve(path.join(songsRoot, fileName));
    const resolvedRoot = path.resolve(songsRoot);

    if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
      return new Response('Forbidden', { status: 403 });
    }
    
    try {
      const stats = await fs.stat(fullPath);
      const fileSize = stats.size;
      
      // Check for Range header (sent by audio/video elements when seeking)
      const rangeHeader = request.headers.get('range');
      
      if (rangeHeader) {
        // Parse range header format: "bytes=start-end" or "bytes=start-" (to end of file)
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        // Read only the requested byte range from disk
        const fileHandle = await fs.open(fullPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();
        
        // Return 206 Partial Content response with proper headers
        // This tells the browser "here's the chunk you asked for"
        return new Response(buffer, {
          status: 206, // 206 = Partial Content (standard for Range responses)
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`, // "I'm sending bytes X-Y of total Z"
            'Accept-Ranges': 'bytes',                              // "I support range requests"
            'Content-Length': chunkSize.toString(),                // Size of this chunk
            'Content-Type': getContentType(fullPath),              // MIME type
          }
        });
      } else {
        // No range request - return full file (initial load or small files)
        return net.fetch('file://' + encodeURI(fullPath));
      }
    } catch (error) {
      console.error('[wolk protocol] Error:', error);
      return new Response('File not found', { status: 404 });
    }
  })

}

/**
 * Maps file extensions to their correct MIME types.
 * Important for browsers to handle files correctly.
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    // fonts
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[ext] || 'application/octet-stream';
}





// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {

  askPermissions();
  setProtocols();

  await initStorage();
  await registerInternalProcesses();

  setApplicationMenu();
  createWindow();



});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
