export const APP_MENU_ACTION_CHANNEL = 'wolk:app-menu-action' as const;

export type AppMenuAction =
    | { type: 'file.newProject' }
    | { type: 'file.openProjectArchive' }
    | { type: 'file.exportProjectArchive' }
    | { type: 'file.importPresetBundle' }
    | { type: 'file.exportPresetBundle' }
    | { type: 'file.openRecent'; projectId: string }
    | { type: 'app.showProjects' }
    | { type: 'app.openStorageFolder' };

export interface RecentProjectMenuEntry {
    id: string;
    title: string;
}
