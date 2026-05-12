import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenuTemplate } from '@/back-end/application-menu';

const getEditItems = (template: ReturnType<typeof buildApplicationMenuTemplate>, isMac = false) => {
  const editMenu = template[isMac ? 2 : 1];
  return editMenu.submenu as Exclude<typeof editMenu.submenu, undefined>;
};

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

    const editItems = getEditItems(template);
    const deleteItem = editItems.find((item) => 'label' in item && item.label === 'Delete');
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

    const editItems = getEditItems(template, true);
    const deleteItem = editItems.find((item) => 'label' in item && item.label === 'Delete');
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

  it('uses standard Edit labels when text is focused', () => {
    const template = buildApplicationMenuTemplate({
      applicationName: 'WOLK',
      canExportProjectArchive: true,
      isMac: false,
      menuContext: {
        hasProjectRoute: true,
        hasEditableFocus: true,
        mode: 'lyric',
        hasSelection: true,
        selectedMotionTrackId: null,
        hasLyricClipboard: true,
        hasMotionClipboard: false,
      },
      recentProjects: [],
      sendAppMenuAction: vi.fn(),
      sendProjectEditorCommand: vi.fn(),
      openExternalUrl: vi.fn(),
    });

    const labels = getEditItems(template).map((item) => 'label' in item ? item.label : item.type);
    expect(labels).toContain('Cut');
    expect(labels).toContain('Copy');
    expect(labels).toContain('Paste');
    expect(labels).toContain('Delete');
  });

  it('uses lyric selection labels and clipboard availability in lyric mode', () => {
    const template = buildApplicationMenuTemplate({
      applicationName: 'WOLK',
      canExportProjectArchive: true,
      isMac: false,
      menuContext: {
        hasProjectRoute: true,
        hasEditableFocus: false,
        mode: 'lyric',
        hasSelection: false,
        selectedMotionTrackId: null,
        hasLyricClipboard: true,
        hasMotionClipboard: false,
      },
      recentProjects: [],
      sendAppMenuAction: vi.fn(),
      sendProjectEditorCommand: vi.fn(),
      openExternalUrl: vi.fn(),
    });

    const editItems = getEditItems(template);
    const cutItem = editItems.find((item) => 'label' in item && item.label === 'Cut Lyric Selection');
    const pasteItem = editItems.find((item) => 'label' in item && item.label === 'Paste Lyric Selection');

    expect(cutItem && 'enabled' in cutItem ? cutItem.enabled : undefined).toBe(false);
    expect(pasteItem && 'enabled' in pasteItem ? pasteItem.enabled : undefined).toBe(true);
  });

  it('uses motion track labels and clipboard availability in motion mode', () => {
    const template = buildApplicationMenuTemplate({
      applicationName: 'WOLK',
      canExportProjectArchive: true,
      isMac: false,
      menuContext: {
        hasProjectRoute: true,
        hasEditableFocus: false,
        mode: 'motion',
        hasSelection: false,
        selectedMotionTrackId: 'motion-track-1',
        hasLyricClipboard: false,
        hasMotionClipboard: false,
      },
      recentProjects: [],
      sendAppMenuAction: vi.fn(),
      sendProjectEditorCommand: vi.fn(),
      openExternalUrl: vi.fn(),
    });

    const editItems = getEditItems(template);
    const copyItem = editItems.find((item) => 'label' in item && item.label === 'Copy Motion Track');
    const pasteItem = editItems.find((item) => 'label' in item && item.label === 'Paste Motion Track');

    expect(copyItem && 'enabled' in copyItem ? copyItem.enabled : undefined).toBe(true);
    expect(pasteItem && 'enabled' in pasteItem ? pasteItem.enabled : undefined).toBe(false);
  });
});
