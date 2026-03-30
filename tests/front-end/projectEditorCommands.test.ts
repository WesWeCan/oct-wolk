import { describe, expect, it, vi } from 'vitest';
import {
  executeProjectEditorCommand,
  getProjectEditorCommandIdFromKeydown,
  PROJECT_EDITOR_MENU_COMMANDS,
  TIMELINE_NUDGE_MS,
  type ProjectEditorCommandContext,
} from '@/shared/projectEditorCommands';

const createContext = (overrides: Partial<ProjectEditorCommandContext> = {}): ProjectEditorCommandContext => ({
  mode: 'lyric',
  hasSelection: false,
  selectedMotionTrackId: null,
  clearSelection: vi.fn(),
  togglePlayback: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  copyLyricSelection: vi.fn(),
  cutLyricSelection: vi.fn(),
  pasteLyricSelection: vi.fn(),
  deleteLyricSelection: vi.fn(),
  splitSelectionAtPlayhead: vi.fn(),
  toggleRippleMode: vi.fn(),
  zoomToFit: vi.fn(),
  zoomToSelection: vi.fn(),
  jumpToSelectionEdge: vi.fn(),
  cycleSelection: vi.fn(),
  nudgeLyricSelection: vi.fn(),
  deleteMotionTrack: vi.fn(),
  copyMotionTrack: vi.fn(),
  pasteMotionTrack: vi.fn(),
  nudgeMotionTrack: vi.fn(),
  stepPlayhead: vi.fn(),
  ...overrides,
});

describe('projectEditorCommands', () => {
  it('keeps menu-backed shortcuts out of renderer keydown mapping', () => {
    expect(getProjectEditorCommandIdFromKeydown({
      code: 'KeyZ',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    }, { mode: 'lyric' })).toBeNull();

    expect(getProjectEditorCommandIdFromKeydown({
      code: 'KeyS',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    }, { mode: 'lyric' })).toBe('edit.split');

    expect(getProjectEditorCommandIdFromKeydown({
      code: 'KeyS',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    }, { mode: 'motion' })).toBeNull();
  });

  it('routes clipboard commands by editor mode', () => {
    const lyricContext = createContext({ mode: 'lyric' });
    executeProjectEditorCommand('edit.copy', lyricContext);
    executeProjectEditorCommand('edit.cut', lyricContext);
    executeProjectEditorCommand('edit.paste', lyricContext);
    executeProjectEditorCommand('edit.delete', lyricContext);

    expect(lyricContext.copyLyricSelection).toHaveBeenCalledTimes(1);
    expect(lyricContext.cutLyricSelection).toHaveBeenCalledTimes(1);
    expect(lyricContext.pasteLyricSelection).toHaveBeenCalledTimes(1);
    expect(lyricContext.deleteLyricSelection).toHaveBeenCalledTimes(1);

    const motionContext = createContext({ mode: 'motion', selectedMotionTrackId: 'track-1' });
    executeProjectEditorCommand('edit.copy', motionContext);
    executeProjectEditorCommand('edit.cut', motionContext);
    executeProjectEditorCommand('edit.paste', motionContext);
    executeProjectEditorCommand('edit.delete', motionContext);

    expect(motionContext.copyMotionTrack).toHaveBeenCalledTimes(1);
    expect(motionContext.deleteMotionTrack).toHaveBeenCalledTimes(2);
    expect(motionContext.pasteMotionTrack).toHaveBeenCalledTimes(1);
  });

  it('nudges motion, lyric selection, or playhead using the shared timeline step size', () => {
    const motionContext = createContext({ mode: 'motion', selectedMotionTrackId: 'track-1' });
    executeProjectEditorCommand('timeline.nudge.left.large', motionContext);
    expect(motionContext.nudgeMotionTrack).toHaveBeenCalledWith(-TIMELINE_NUDGE_MS * 10);

    const lyricContext = createContext({ hasSelection: true });
    executeProjectEditorCommand('timeline.nudge.right', lyricContext);
    expect(lyricContext.nudgeLyricSelection).toHaveBeenCalledWith(TIMELINE_NUDGE_MS);

    const playheadContext = createContext();
    executeProjectEditorCommand('timeline.nudge.left', playheadContext);
    expect(playheadContext.stepPlayhead).toHaveBeenCalledWith(-1);
  });

  it('defines menu commands with the expected accelerators', () => {
    const acceleratorMap = new Map(PROJECT_EDITOR_MENU_COMMANDS.map((command) => [command.id, command.accelerator ?? null]));

    expect(acceleratorMap.get('edit.undo')).toBe('CommandOrControl+Z');
    expect(acceleratorMap.get('edit.redo')).toBe('CommandOrControl+Shift+Z');
    expect(acceleratorMap.get('edit.copy')).toBe('CommandOrControl+C');
    expect(acceleratorMap.get('edit.split')).toBe('CommandOrControl+K');
  });
});
