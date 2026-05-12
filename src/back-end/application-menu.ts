import type { MenuItemConstructorOptions } from 'electron';
import type { AppMenuAction, RecentProjectMenuEntry } from '../shared/appMenuActions';
import {
    DEFAULT_PROJECT_EDITOR_MENU_CONTEXT,
    PROJECT_EDITOR_MENU_COMMANDS,
    type ProjectEditorCommandId,
    type ProjectEditorMenuContext,
} from '../shared/projectEditorCommands';
import { BRANDING } from '@/shared/branding';

export interface BuildApplicationMenuOptions {
    applicationName: string;
    canExportProjectArchive: boolean;
    isMac: boolean;
    menuContext?: ProjectEditorMenuContext;
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
    options: {
        accelerator?: string;
        enabled?: boolean;
        label?: string;
    } = {},
): MenuItemConstructorOptions => {
    const definition = byId(commandId);

    return {
        label: options.label ?? definition.label,
        accelerator: options.accelerator ?? definition.accelerator,
        enabled: options.enabled,
        click: () => {
            sendProjectEditorCommand(commandId);
        },
    };
};

const editMenuLabel = (
    commandId: ProjectEditorCommandId,
    context: ProjectEditorMenuContext,
): string | undefined => {
    if (context.hasEditableFocus || !context.hasProjectRoute) {
        const editableLabels: Partial<Record<ProjectEditorCommandId, string>> = {
            'edit.cut': 'Cut',
            'edit.copy': 'Copy',
            'edit.paste': 'Paste',
            'edit.delete': 'Delete',
        };

        return editableLabels[commandId];
    }

    if (context.mode === 'motion') {
        const motionLabels: Partial<Record<ProjectEditorCommandId, string>> = {
            'edit.cut': 'Cut Motion Track',
            'edit.copy': 'Copy Motion Track',
            'edit.paste': 'Paste Motion Track',
            'edit.delete': 'Delete Motion Track',
        };

        return motionLabels[commandId];
    }

    const lyricLabels: Partial<Record<ProjectEditorCommandId, string>> = {
        'edit.cut': 'Cut Lyric Selection',
        'edit.copy': 'Copy Lyric Selection',
        'edit.paste': 'Paste Lyric Selection',
        'edit.delete': 'Delete Lyric Selection',
    };

    return lyricLabels[commandId];
};

const editMenuEnabled = (
    commandId: ProjectEditorCommandId,
    context: ProjectEditorMenuContext,
): boolean => {
    if (context.hasEditableFocus) return true;
    if (!context.hasProjectRoute) return false;

    switch (commandId) {
        case 'edit.cut':
        case 'edit.copy':
        case 'edit.delete':
            return context.mode === 'motion'
                ? !!context.selectedMotionTrackId
                : context.hasSelection;
        case 'edit.paste':
            return context.mode === 'motion'
                ? context.hasMotionClipboard
                : context.hasLyricClipboard;
        case 'edit.split':
            return context.mode === 'lyric' && context.hasSelection;
        default:
            return true;
    }
};

export const buildApplicationMenuTemplate = ({
    applicationName,
    canExportProjectArchive,
    isMac,
    menuContext = DEFAULT_PROJECT_EDITOR_MENU_CONTEXT,
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
            createCommandItem('edit.cut', sendProjectEditorCommand, {
                enabled: editMenuEnabled('edit.cut', menuContext),
                label: editMenuLabel('edit.cut', menuContext),
            }),
            createCommandItem('edit.copy', sendProjectEditorCommand, {
                enabled: editMenuEnabled('edit.copy', menuContext),
                label: editMenuLabel('edit.copy', menuContext),
            }),
            createCommandItem('edit.paste', sendProjectEditorCommand, {
                enabled: editMenuEnabled('edit.paste', menuContext),
                label: editMenuLabel('edit.paste', menuContext),
            }),
            createCommandItem('edit.delete', sendProjectEditorCommand, {
                accelerator: isMac ? 'Backspace' : 'Delete',
                enabled: editMenuEnabled('edit.delete', menuContext),
                label: editMenuLabel('edit.delete', menuContext),
            }),
            { type: 'separator' },
            createCommandItem('edit.split', sendProjectEditorCommand, {
                enabled: editMenuEnabled('edit.split', menuContext),
            }),
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
