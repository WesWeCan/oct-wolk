import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { getInternalStoragePath } from './internal-storage';
import { createOrLoadTimeline, saveTimeline, listScenes as listSceneFiles, saveScene, loadScene } from './timeline-storage';
import { listSystemFonts } from './fonts';
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

    // Timeline API
    ipcMain.handle('timeline:createOrLoad', (_event, songId: string) => {
        return createOrLoadTimeline(songId);
    });
    ipcMain.handle('timeline:save', (_event, songId: string, timeline: any) => {
        return saveTimeline(songId, timeline);
    });
    ipcMain.handle('timeline:listScenes', (_event, songId: string) => {
        return listSceneFiles(songId);
    });
    ipcMain.handle('timeline:saveScene', (_event, songId: string, scene: any) => {
        return saveScene(songId, scene);
    });
    ipcMain.handle('timeline:loadScene', (_event, songId: string, sceneId: string) => {
        return loadScene(songId, sceneId);
    });

    // Fonts API
    ipcMain.handle('fonts:list', () => {
        return listSystemFonts();
    });

}