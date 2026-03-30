import { app, BrowserWindow, ipcMain, Menu, net, protocol } from 'electron';
import { spawnSync } from 'node:child_process';
import fsSync from 'node:fs';
import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import { getDocStoragePath, initStorage } from './back-end/internal-processes/internal-storage';
import { listProjects } from './back-end/internal-processes/project-storage';
import { registerInternalProcesses } from './back-end/internal-processes/internal-processes';
import { buildApplicationMenuTemplate } from './back-end/application-menu';
import { openExternalHttpUrl } from './back-end/internal-processes/external-links';
import { APP_MENU_ACTION_CHANNEL, type AppMenuAction } from './shared/appMenuActions';
import { MENU_COMMAND_CHANNEL, type ProjectEditorCommandId } from './shared/projectEditorCommands';
import { importProjectArchiveFromPath } from './back-end/internal-processes/project-archive';
import { WOLK_PROJECT_EXTENSION } from '@/types/archive_types';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';

if (started) {
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let appReadyForImports = false;
let processingPendingArchives = false;
let hasProjectRoute = false;
const pendingArchivePaths: string[] = [];
const pendingImportedProjectIds: string[] = [];

const normalizeOpenedArchivePath = (candidate: string): string | null => {
  const trimmed = String(candidate || '').trim();
  if (!trimmed) return null;
  if (!trimmed.toLowerCase().endsWith(`.${WOLK_PROJECT_EXTENSION}`)) return null;
  return trimmed;
};

const extractArchivePathsFromArgv = (argv: string[]): string[] => {
  return argv
    .map((value) => normalizeOpenedArchivePath(value))
    .filter((value): value is string => !!value);
};

const queueImportedProjectId = (projectId: string) => {
  if (!projectId) return;
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('projects:imported', { projectId });
    return;
  }
  pendingImportedProjectIds.push(projectId);
};

const flushImportedProjectIds = () => {
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed()) return;
  while (pendingImportedProjectIds.length > 0) {
    const projectId = pendingImportedProjectIds.shift();
    if (projectId) {
      mainWindow.webContents.send('projects:imported', { projectId });
    }
  }
};

const processPendingArchivePaths = async () => {
  if (!appReadyForImports || processingPendingArchives) return;
  processingPendingArchives = true;

  try {
    while (pendingArchivePaths.length > 0) {
      const archivePath = pendingArchivePaths.shift();
      if (!archivePath) continue;

      try {
        const project = await importProjectArchiveFromPath(archivePath);
        queueImportedProjectId(project.id);
        setApplicationMenu();
      } catch (error) {
        console.error('[wolk open-file] Failed to import archive:', archivePath, error);
      }
    }
  } finally {
    processingPendingArchives = false;
  }
};

const queueArchivePath = (candidate: string) => {
  const filePath = normalizeOpenedArchivePath(candidate);
  if (!filePath) return;
  if (!fsSync.existsSync(filePath)) return;
  pendingArchivePaths.push(filePath);
  void processPendingArchivePaths();
};

const sendProjectEditorMenuCommand = (commandId: ProjectEditorCommandId) => {
  const target = BrowserWindow.getFocusedWindow() || mainWindow;
  target?.webContents.send(MENU_COMMAND_CHANNEL, commandId);
};

const sendAppMenuAction = (action: AppMenuAction) => {
  const target = BrowserWindow.getFocusedWindow() || mainWindow;
  target?.webContents.send(APP_MENU_ACTION_CHANNEL, action);
};

const setApplicationMenu = () => {
  const recentProjects = listProjects()
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, 10)
    .map((project) => ({
      id: project.id,
      title: project.song.title || 'Untitled',
    }));

  const menu = Menu.buildFromTemplate(buildApplicationMenuTemplate({
    applicationName: app.name,
    canExportProjectArchive: hasProjectRoute,
    isMac: process.platform === 'darwin',
    recentProjects,
    sendAppMenuAction,
    sendProjectEditorCommand: sendProjectEditorMenuCommand,
    openExternalUrl: (url) => openExternalHttpUrl(url),
  }));

  Menu.setApplicationMenu(menu);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1000,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

const registerWindowsFileAssociation = () => {
  if (process.platform !== 'win32' || !app.isPackaged) return;

  const exePath = process.execPath;
  const associationRoot = 'HKCU\\Software\\Classes';
  const extensionKey = `${associationRoot}\\.${WOLK_PROJECT_EXTENSION}`;
  const progId = 'WOLK.Project';
  const progIdKey = `${associationRoot}\\${progId}`;
  const commands = [
    ['add', extensionKey, '/ve', '/d', progId, '/f'],
    ['add', progIdKey, '/ve', '/d', 'WOLK Project', '/f'],
    ['add', `${progIdKey}\\DefaultIcon`, '/ve', '/d', `"${exePath}",0`, '/f'],
    ['add', `${progIdKey}\\shell\\open\\command`, '/ve', '/d', `"${exePath}" "%1"`, '/f'],
  ];

  for (const args of commands) {
    try {
      const result = spawnSync('reg', args, { stdio: 'ignore' });
      if (result.status !== 0) {
        console.warn('[wolk file association] Failed command:', args.join(' '));
      }
    } catch (error) {
      console.warn('[wolk file association] Registry write failed:', error);
    }
  }
};

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
]);

const setProtocols = async () => {
  protocol.handle('wolk', async (request) => {
    const fileName = decodeURIComponent(request.url.slice('wolk://'.length));
    const songsRoot = getDocStoragePath(DOCUMENT_STORAGE_FOLDER.SONGS);
    const fullPath = path.resolve(path.join(songsRoot, fileName));
    const resolvedRoot = path.resolve(songsRoot);

    if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const stats = await fs.stat(fullPath);
      const fileSize = stats.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        const fileHandle = await fs.open(fullPath, 'r');
        const buffer = Buffer.alloc(chunkSize);
        await fileHandle.read(buffer, 0, chunkSize, start);
        await fileHandle.close();

        return new Response(buffer, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': getContentType(fullPath),
          }
        });
      }

      return net.fetch('file://' + encodeURI(fullPath));
    } catch (error) {
      console.error('[wolk protocol] Error:', error);
      return new Response('File not found', { status: 404 });
    }
  });
};

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
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[ext] || 'application/octet-stream';
}

ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  flushImportedProjectIds();
  void processPendingArchivePaths();
});

app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  for (const filePath of extractArchivePathsFromArgv(argv)) {
    queueArchivePath(filePath);
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queueArchivePath(filePath);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  setProtocols();

  await initStorage();
  await registerInternalProcesses({
    onMenuContextChanged: (context) => {
      hasProjectRoute = context.hasProjectRoute;
      setApplicationMenu();
    },
    onProjectsChanged: setApplicationMenu,
  });
  appReadyForImports = true;
  registerWindowsFileAssociation();

  setApplicationMenu();
  createWindow();

  for (const filePath of extractArchivePathsFromArgv(process.argv)) {
    queueArchivePath(filePath);
  }
  void processPendingArchivePaths();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    flushImportedProjectIds();
  }
});
