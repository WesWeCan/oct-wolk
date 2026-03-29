import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenuTemplate } from '@/back-end/application-menu';

describe('buildApplicationMenuTemplate', () => {
  it('builds the Windows/Linux menu with preview-only File items', () => {
    const sendProjectEditorCommand = vi.fn();
    const openExternalUrl = vi.fn();
    const template = buildApplicationMenuTemplate({
      applicationName: 'WOLK',
      isMac: false,
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
    const previewItems = fileItems.filter((item) => 'label' in item && item.label);

    expect(previewItems.every((item) => item.enabled === false)).toBe(true);
    expect(previewItems.map((item) => item.label)).toContain('Open .wolk... (Coming Soon)');
    expect(previewItems.map((item) => item.label)).toContain('Save As... (Coming Soon)');
    expect(previewItems.map((item) => item.label)).toContain('Export .wolkpresets... (Coming Soon)');

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
      isMac: true,
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
  });
});
