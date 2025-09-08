import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { getInternalStoragePath } from './internal-storage';
import { createSong, loadSong, saveSong, listSongs, saveSongCover, saveSongAudio } from './song-storage';



export const registerInternalProcesses = async () => {
    console.log('Registering internal processes...');
    
    // Existing IPC handler
    ipcMain.handle('getRandomNumber', () => {
        console.log('getRandomNumber IPC handler called');
        const number = Math.floor(Math.random() * 100);
        console.log('Generated random number:', number);
        return number;
    });

    ipcMain.handle('open-storage-folder', () => {
        return shell.openPath(getInternalStoragePath());
    });

    // Songs API
    ipcMain.handle('songs:create', (_event, initial) => {
        return createSong(initial);
    });
    ipcMain.handle('songs:save', (_event, song) => {
        return saveSong(song);
    });
    ipcMain.handle('songs:load', (_event, songId: string) => {
        return loadSong(songId);
    });
    ipcMain.handle('songs:list', () => {
        return listSongs();
    });

    // Uploads
    ipcMain.handle('songs:uploadCover', (_event, songId: string, fileData: ArrayBuffer, originalFileName: string) => {
        return saveSongCover(songId, fileData, originalFileName);
    });
    ipcMain.handle('songs:uploadAudio', (_event, songId: string, fileData: ArrayBuffer, originalFileName: string) => {
        return saveSongAudio(songId, fileData, originalFileName);
    });

}