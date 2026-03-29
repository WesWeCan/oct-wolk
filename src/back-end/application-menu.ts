import type { MenuItemConstructorOptions } from 'electron';
import { PROJECT_EDITOR_MENU_COMMANDS, type ProjectEditorCommandId } from '../shared/projectEditorCommands';

const GITHUB_URL = 'https://github.com/WesWeCan/oct-wolk';
const RELEASES_URL = 'https://github.com/WesWeCan/oct-wolk/releases';

export interface BuildApplicationMenuOptions {
    applicationName: string;
    isMac: boolean;
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

const createPreviewItem = (label: string): MenuItemConstructorOptions => ({
    label: `${label} (Coming Soon)`,
    enabled: false,
});

export const buildApplicationMenuTemplate = ({
    applicationName,
    isMac,
    sendProjectEditorCommand,
    openExternalUrl,
}: BuildApplicationMenuOptions): MenuItemConstructorOptions[] => {
    const fileMenu: MenuItemConstructorOptions = {
        label: 'File',
        submenu: [
            createPreviewItem('New Project'),
            createPreviewItem('Open .wolk...'),
            createPreviewItem('Import .wolk...'),
            { type: 'separator' },
            createPreviewItem('Save'),
            createPreviewItem('Save As...'),
            { type: 'separator' },
            createPreviewItem('Import .wolkpreset...'),
            createPreviewItem('Export .wolkpreset...'),
            createPreviewItem('Export .wolkpresets...'),
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
                    void openExternalUrl(GITHUB_URL);
                },
            },
            {
                label: 'Releases',
                click: () => {
                    void openExternalUrl(RELEASES_URL);
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
