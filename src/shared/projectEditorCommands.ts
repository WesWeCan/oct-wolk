export const MENU_COMMAND_CHANNEL = 'wolk:menu-command' as const;
export const RENDERER_MENU_COMMAND_EVENT = 'wolk:renderer-menu-command' as const;
export const TIMELINE_NUDGE_MS = 50;

export type NativeEditCommandId = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'delete';

export interface ProjectEditorMenuContext {
    hasProjectRoute: boolean;
    hasEditableFocus: boolean;
    mode: 'lyric' | 'motion';
    hasSelection: boolean;
    selectedMotionTrackId: string | null;
    hasLyricClipboard: boolean;
    hasMotionClipboard: boolean;
}

export const DEFAULT_PROJECT_EDITOR_MENU_CONTEXT: ProjectEditorMenuContext = {
    hasProjectRoute: false,
    hasEditableFocus: false,
    mode: 'lyric',
    hasSelection: false,
    selectedMotionTrackId: null,
    hasLyricClipboard: false,
    hasMotionClipboard: false,
};

export type ProjectEditorCommandId =
    | 'edit.undo'
    | 'edit.redo'
    | 'edit.cut'
    | 'edit.copy'
    | 'edit.paste'
    | 'edit.delete'
    | 'edit.split'
    | 'selection.clear'
    | 'playback.toggle'
    | 'view.zoom.fit'
    | 'view.zoom.selection'
    | 'playhead.jump.in'
    | 'playhead.jump.out'
    | 'selection.cycle.forward'
    | 'selection.cycle.backward'
    | 'timeline.nudge.left'
    | 'timeline.nudge.left.large'
    | 'timeline.nudge.right'
    | 'timeline.nudge.right.large';

export interface ProjectEditorCommandDefinition {
    id: ProjectEditorCommandId;
    label: string;
    accelerator?: string;
}

export const PROJECT_EDITOR_MENU_COMMANDS: ProjectEditorCommandDefinition[] = [
    { id: 'edit.undo', label: 'Undo', accelerator: 'CommandOrControl+Z' },
    { id: 'edit.redo', label: 'Redo', accelerator: 'CommandOrControl+Shift+Z' },
    { id: 'edit.cut', label: 'Cut Selection', accelerator: 'CommandOrControl+X' },
    { id: 'edit.copy', label: 'Copy Selection', accelerator: 'CommandOrControl+C' },
    { id: 'edit.paste', label: 'Paste Selection', accelerator: 'CommandOrControl+V' },
    { id: 'edit.delete', label: 'Delete Selection' },
    { id: 'edit.split', label: 'Split At Playhead', accelerator: 'CommandOrControl+K' },
];

export interface ProjectEditorKeyCommandEvent {
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

export interface ProjectEditorKeyCommandOptions {
    mode: 'lyric' | 'motion';
}

export const getProjectEditorCommandIdFromKeydown = (
    event: ProjectEditorKeyCommandEvent,
    options: ProjectEditorKeyCommandOptions,
): ProjectEditorCommandId | null => {
    const isMeta = event.metaKey || event.ctrlKey;

    if (event.code === 'Escape') return 'selection.clear';
    if (event.code === 'Space') return 'playback.toggle';
    if (event.code === 'KeyS' && !isMeta && options.mode !== 'motion') return 'edit.split';
    if (event.code === 'Digit0' && isMeta && !event.shiftKey) return 'view.zoom.fit';
    if (event.code === 'Digit0' && isMeta && event.shiftKey) return 'view.zoom.selection';
    if (event.code === 'KeyI' && !isMeta) return 'playhead.jump.in';
    if (event.code === 'KeyO' && !isMeta) return 'playhead.jump.out';
    if (event.code === 'Tab' && !event.shiftKey) return 'selection.cycle.forward';
    if (event.code === 'Tab' && event.shiftKey) return 'selection.cycle.backward';
    if (event.code === 'ArrowLeft' && !event.shiftKey) return 'timeline.nudge.left';
    if (event.code === 'ArrowLeft' && event.shiftKey) return 'timeline.nudge.left.large';
    if (event.code === 'ArrowRight' && !event.shiftKey) return 'timeline.nudge.right';
    if (event.code === 'ArrowRight' && event.shiftKey) return 'timeline.nudge.right.large';

    return null;
};

export interface ProjectEditorCommandContext {
    mode: 'lyric' | 'motion';
    hasSelection: boolean;
    selectedMotionTrackId: string | null;
    clearSelection: () => void;
    togglePlayback: () => void | Promise<void>;
    undo: () => void;
    redo: () => void;
    copyLyricSelection: () => void;
    cutLyricSelection: () => void;
    pasteLyricSelection: () => void;
    deleteLyricSelection: () => void;
    splitSelectionAtPlayhead: () => void;
    zoomToFit: () => void;
    zoomToSelection: () => void;
    jumpToSelectionEdge: (edge: 'in' | 'out') => void;
    cycleSelection: (forward: boolean) => void;
    nudgeLyricSelection: (deltaMs: number) => void;
    deleteMotionTrack: () => void;
    copyMotionTrack: () => void;
    cutMotionTrack: () => void;
    pasteMotionTrack: () => void;
    nudgeMotionTrack: (deltaMs: number) => void;
    stepPlayhead: (deltaFrames: number) => void;
}

export const executeProjectEditorCommand = (
    commandId: ProjectEditorCommandId,
    context: ProjectEditorCommandContext,
): void => {
    switch (commandId) {
        case 'selection.clear':
            context.clearSelection();
            return;
        case 'playback.toggle':
            void context.togglePlayback();
            return;
        case 'edit.undo':
            context.undo();
            return;
        case 'edit.redo':
            context.redo();
            return;
        case 'edit.copy':
            if (context.mode === 'motion') context.copyMotionTrack();
            else context.copyLyricSelection();
            return;
        case 'edit.cut':
            if (context.mode === 'motion') context.cutMotionTrack();
            else context.cutLyricSelection();
            return;
        case 'edit.paste':
            if (context.mode === 'motion') context.pasteMotionTrack();
            else context.pasteLyricSelection();
            return;
        case 'edit.delete':
            if (context.mode === 'motion') context.deleteMotionTrack();
            else context.deleteLyricSelection();
            return;
        case 'edit.split':
            context.splitSelectionAtPlayhead();
            return;
        case 'view.zoom.fit':
            context.zoomToFit();
            return;
        case 'view.zoom.selection':
            context.zoomToSelection();
            return;
        case 'playhead.jump.in':
            context.jumpToSelectionEdge('in');
            return;
        case 'playhead.jump.out':
            context.jumpToSelectionEdge('out');
            return;
        case 'selection.cycle.forward':
            context.cycleSelection(true);
            return;
        case 'selection.cycle.backward':
            context.cycleSelection(false);
            return;
        case 'timeline.nudge.left':
            if (context.mode === 'motion' && context.selectedMotionTrackId) context.nudgeMotionTrack(-TIMELINE_NUDGE_MS);
            else if (context.hasSelection) context.nudgeLyricSelection(-TIMELINE_NUDGE_MS);
            else context.stepPlayhead(-1);
            return;
        case 'timeline.nudge.left.large':
            if (context.mode === 'motion' && context.selectedMotionTrackId) context.nudgeMotionTrack(-TIMELINE_NUDGE_MS * 10);
            else if (context.hasSelection) context.nudgeLyricSelection(-TIMELINE_NUDGE_MS * 10);
            else context.stepPlayhead(-10);
            return;
        case 'timeline.nudge.right':
            if (context.mode === 'motion' && context.selectedMotionTrackId) context.nudgeMotionTrack(TIMELINE_NUDGE_MS);
            else if (context.hasSelection) context.nudgeLyricSelection(TIMELINE_NUDGE_MS);
            else context.stepPlayhead(1);
            return;
        case 'timeline.nudge.right.large':
            if (context.mode === 'motion' && context.selectedMotionTrackId) context.nudgeMotionTrack(TIMELINE_NUDGE_MS * 10);
            else if (context.hasSelection) context.nudgeLyricSelection(TIMELINE_NUDGE_MS * 10);
            else context.stepPlayhead(10);
            return;
    }
};
