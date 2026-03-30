import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenuTemplate } from '@/back-end/application-menu';

describe('buildApplicationMenuTemplate', () => {
  it('builds the Windows/Linux menu with wired File actions and recent projects', () => {
    const sendAppMenuAction = vi.fn();
    const sendProjectEditorCommand = vi.fn();
    const openExternalUrl = vi.fn();
    const template = buildApplicationMenuTemplate({
      applicationName: 'WOLK',
      canExportProjectArchive: false,
      isMac: false,
      recentProjects: [
        { id: 'project-1', title: 'Recent One' },
        { id: 'project-2', title: 'Recent Two' },
      ],
      sendAppMenuAction,
      sendProjectEditorCommand,
      openExternalUrl,
    });

    expect(template.map((item) => item.label ?? item.role)).toEqual([
      'File',
      'Edit',
      'View',
      'Window',
      'help',
    ]);

    const fileMenu = template[0];
    const fileItems = fileMenu.submenu as Exclude<typeof fileMenu.submenu, undefined>;
    expect(fileItems.map((item) => 'label' in item ? item.label : item.role)).toContain('New Project');
    expect(fileItems.map((item) => 'label' in item ? item.label : item.role)).toContain('Show Projects');
    expect(fileItems.map((item) => 'label' in item ? item.label : item.role)).toContain('Open .wolk...');
    expect(fileItems.map((item) => 'label' in item ? item.label : item.role)).toContain('Export Presets...');
    expect(fileItems.map((item) => 'label' in item ? item.label : item.role)).toContain('Open Storage Folder');
    expect(fileItems.map((item) => 'label' in item ? item.label : item.role)).toContain('quit');
    const exportProjectItem = fileItems.find((item) => 'label' in item && item.label === 'Export .wolk...');
    expect(exportProjectItem && 'enabled' in exportProjectItem ? exportProjectItem.enabled : undefined).toBe(false);

    const recentMenu = fileItems.find((item) => 'label' in item && item.label === 'Open Recent');
    expect(recentMenu && 'submenu' in recentMenu ? recentMenu.submenu?.map((item) => 'label' in item ? item.label : item.role) : []).toEqual([
      'Recent One',
      'Recent Two',
    ]);

    const editMenu = template[1];
    const editItems = editMenu.submenu as Exclude<typeof editMenu.submenu, undefined>;
    const deleteItem = editItems.find((item) => 'label' in item && item.label === 'Delete Selection');
    expect(deleteItem && 'accelerator' in deleteItem ? deleteItem.accelerator : null).toBe('Delete');

    const helpMenu = template[4];
    const helpItems = helpMenu.submenu as Exclude<typeof helpMenu.submenu, undefined>;
    expect(helpItems.map((item) => 'label' in item ? item.label : item.role)).toEqual([
      'GitHub Repository',
      'Releases',
    ]);
  });

  it('builds the macOS wrapper menu and mac-specific delete accelerator', () => {
    const template = buildApplicationMenuTemplate({
      applicationName: 'WOLK',
      canExportProjectArchive: true,
      isMac: true,
      recentProjects: [],
      sendAppMenuAction: vi.fn(),
      sendProjectEditorCommand: vi.fn(),
      openExternalUrl: vi.fn(),
    });

    expect(template[0].label).toBe('WOLK');
    expect(template[1].label).toBe('File');

    const editMenu = template[2];
    const editItems = editMenu.submenu as Exclude<typeof editMenu.submenu, undefined>;
    const deleteItem = editItems.find((item) => 'label' in item && item.label === 'Delete Selection');
    expect(deleteItem && 'accelerator' in deleteItem ? deleteItem.accelerator : null).toBe('Backspace');

    const windowMenu = template[4];
    const windowItems = windowMenu.submenu as Exclude<typeof windowMenu.submenu, undefined>;
    expect(windowItems.some((item) => 'role' in item && item.role === 'front')).toBe(true);

    const fileMenu = template[1];
    const fileItems = fileMenu.submenu as Exclude<typeof fileMenu.submenu, undefined>;
    const recentMenu = fileItems.find((item) => 'label' in item && item.label === 'Open Recent');
    expect(recentMenu && 'submenu' in recentMenu ? recentMenu.submenu?.map((item) => 'label' in item ? item.label : item.role) : []).toEqual([
      'No Recent Projects',
    ]);
    const exportProjectItem = fileItems.find((item) => 'label' in item && item.label === 'Export .wolk...');
    expect(exportProjectItem && 'enabled' in exportProjectItem ? exportProjectItem.enabled : undefined).toBe(true);
  });
});
