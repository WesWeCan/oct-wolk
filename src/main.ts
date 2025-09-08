import { app, BrowserWindow, systemPreferences, protocol, net } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getInternalStoragePath, initStorage } from './back-end/internal-processes/internal-storage';
import { registerInternalProcesses } from './back-end/internal-processes/internal-processes';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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

  protocol.handle('wolk', async (request) => {
    const fileName = decodeURIComponent(request.url.slice('wolk://'.length));
      // Map wolk://songs/... to the internal docStorage songs folder
      const songsRoot = path.join(getInternalStoragePath(), 'docStorage', 'songs');
      const fullPath = path.join(songsRoot, fileName);
    return net.fetch('file://' + encodeURI(fullPath));
  })

}





// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {

  askPermissions();
  setProtocols();

  await initStorage();
  await registerInternalProcesses();

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
