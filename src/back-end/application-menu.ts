import type { MenuItemConstructorOptions } from 'electron';
import type { AppMenuAction, RecentProjectMenuEntry } from '../shared/appMenuActions';
import { PROJECT_EDITOR_MENU_COMMANDS, type ProjectEditorCommandId } from '../shared/projectEditorCommands';
import { BRANDING } from '@/shared/branding';

export interface BuildApplicationMenuOptions {
    applicationName: string;
    canExportProjectArchive: boolean;
    isMac: boolean;
    recentProjects: RecentProjectMenuEntry[];
    sendAppMenuAction: (action: AppMenuAction) => void;
    sendProjectEditorCommand: (commandId: ProjectEditorCommandId) => void;
    openExternalUrl: (url: string) => void | Promise<void>;
}

const byId = (commandId: ProjectEditorCommandId) => {
    const definition = PROJECT_EDITOR_MENU_COMMANDS.find((item) => item.id === commandId);

    if (!definition) {
        throw new Error(`Unknown project editor menu command: ${commandId}`);
    }

    return definition;
};

const createCommandItem = (
    commandId: ProjectEditorCommandId,
    sendProjectEditorCommand: (commandId: ProjectEditorCommandId) => void,
    accelerator?: string,
): MenuItemConstructorOptions => {
    const definition = byId(commandId);

    return {
        label: definition.label,
        accelerator: accelerator ?? definition.accelerator,
        click: () => {
            sendProjectEditorCommand(commandId);
        },
    };
};

export const buildApplicationMenuTemplate = ({
    applicationName,
    canExportProjectArchive,
    isMac,
    recentProjects,
    sendAppMenuAction,
    sendProjectEditorCommand,
    openExternalUrl,
}: BuildApplicationMenuOptions): MenuItemConstructorOptions[] => {
    const openRecentSubmenu: MenuItemConstructorOptions[] = recentProjects.length > 0
        ? recentProjects.map((project) => ({
            label: project.title,
            click: () => {
                sendAppMenuAction({ type: 'file.openRecent', projectId: project.id });
            },
        }))
        : [{ label: 'No Recent Projects', enabled: false }];

    const fileMenu: MenuItemConstructorOptions = {
        label: 'File',
        submenu: [
            {
                label: 'New Project',
                accelerator: 'CommandOrControl+N',
                click: () => {
                    sendAppMenuAction({ type: 'file.newProject' });
                },
            },
            {
                label: 'Show Projects',
                accelerator: 'CommandOrControl+Shift+H',
                click: () => {
                    sendAppMenuAction({ type: 'app.showProjects' });
                },
            },
            {
                label: 'Open Recent',
                submenu: openRecentSubmenu,
            },
            { type: 'separator' },
            {
                label: 'Open .wolk...',
                accelerator: 'CommandOrControl+O',
                click: () => {
                    sendAppMenuAction({ type: 'file.openProjectArchive' });
                },
            },
            {
                label: 'Export .wolk...',
                accelerator: 'CommandOrControl+Shift+E',
                enabled: canExportProjectArchive,
                click: () => {
                    sendAppMenuAction({ type: 'file.exportProjectArchive' });
                },
            },
            { type: 'separator' },
            {
                label: 'Import Presets...',
                click: () => {
                    sendAppMenuAction({ type: 'file.importPresetBundle' });
                },
            },
            {
                label: 'Export Presets...',
                click: () => {
                    sendAppMenuAction({ type: 'file.exportPresetBundle' });
                },
            },
            { type: 'separator' },
            {
                label: 'Open Storage Folder',
                click: () => {
                    sendAppMenuAction({ type: 'app.openStorageFolder' });
                },
            },
            ...(!isMac ? [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'quit' } as MenuItemConstructorOptions] : []),
        ],
    };

    const editMenu: MenuItemConstructorOptions = {
        label: 'Edit',
        submenu: [
            createCommandItem('edit.undo', sendProjectEditorCommand),
            createCommandItem('edit.redo', sendProjectEditorCommand),
            { type: 'separator' },
            createCommandItem('edit.cut', sendProjectEditorCommand),
            createCommandItem('edit.copy', sendProjectEditorCommand),
            createCommandItem('edit.paste', sendProjectEditorCommand),
            createCommandItem('edit.delete', sendProjectEditorCommand, isMac ? 'Backspace' : 'Delete'),
            { type: 'separator' },
            createCommandItem('edit.split', sendProjectEditorCommand),
        ],
    };

    const viewMenu: MenuItemConstructorOptions = {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    };

    const windowMenu: MenuItemConstructorOptions = {
        label: 'Window',
        submenu: isMac
            ? [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
                { role: 'close' },
            ]
            : [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'close' },
            ],
    };

    const helpMenu: MenuItemConstructorOptions = {
        role: 'help',
        submenu: [
            {
                label: 'GitHub Repository',
                click: () => {
                    void openExternalUrl(BRANDING.repositoryUrl);
                },
            },
            {
                label: 'Releases',
                click: () => {
                    void openExternalUrl(BRANDING.releasesUrl);
                },
            },
        ],
    };

    const template: MenuItemConstructorOptions[] = [fileMenu, editMenu, viewMenu, windowMenu, helpMenu];

    if (isMac) {
        template.unshift({
            label: applicationName,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        });
    }

    return template;
};
