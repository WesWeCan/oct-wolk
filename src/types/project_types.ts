// ---------------------------------------------------------------------------
// WolkProject v2 — Lyric-timeline-first data model
// See PRD-lyrics-motion-rebuild.md for full specification
// ---------------------------------------------------------------------------

// ---- Layer A: Lyric Mode --------------------------------------------------

export interface TimelineItem {
    id: string;
    text: string;
    startMs: number;
    endMs: number;
}

export type LyricTrackKind = 'word' | 'sentence' | 'verse' | 'custom';

export interface LyricTrack {
    id: string;
    name: string;
    color: string;
    kind: LyricTrackKind;
    items: TimelineItem[];
    muted: boolean;
    solo: boolean;
    locked: boolean;
}

// ---- Layer B: Motion Mode -------------------------------------------------

export interface SnippetOverride {
    itemId: string;
    hidden: boolean;
    fadeInMs: number;
    fadeOutMs: number;
    textOverride?: string;
}

export interface MotionStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    fontStyle: 'normal' | 'italic' | 'oblique';
    textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    color: string;
    opacity: number;
    backgroundColor: string | null;
    backgroundPadding: number;
}

export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'center' | 'bottom';

export interface MotionTransform {
    anchorX: AnchorX;
    anchorY: AnchorY;
    offsetX: number;
    offsetY: number;
    scale: number;
    rotation: number;
}

export type DisplayMode = 'single' | 'block';

export interface MotionLayer {
    id: string;
    name: string;
    enabled: boolean;
    sourceTrackId: string;
    displayMode: DisplayMode;
    snippets: SnippetOverride[];
    style: MotionStyle;
    transform: MotionTransform;
}

// ---- Project Root ---------------------------------------------------------

export interface WolkProjectSong {
    title: string;
    subtitle?: string;
    audioSrc: string;
    coverSrc?: string;
}

export interface WolkProjectSettings {
    fps: number;
    renderWidth: number;
    renderHeight: number;
    seed: string;
    exportBitrateMbps?: number;
    includeAudio?: boolean;
}

export interface WolkProjectFont {
    family: string;
    fallbacks: string[];
    style: 'normal' | 'italic' | 'oblique';
    weight: number;
    name?: string;
    localPath?: string;
}

export interface WolkProject {
    id: string;
    version: 2;
    song: WolkProjectSong;
    settings: WolkProjectSettings;
    font: WolkProjectFont;
    rawLyrics: string;
    lyricTracks: LyricTrack[];
    motionLayers: MotionLayer[];
    createdAt: number;
    updatedAt: number;
}

// ---- Defaults -------------------------------------------------------------

export const DEFAULT_PROJECT_SETTINGS: WolkProjectSettings = {
    fps: 60,
    renderWidth: 1920,
    renderHeight: 1080,
    seed: 'wolk-default',
};

export const DEFAULT_PROJECT_FONT: WolkProjectFont = {
    family: 'system-ui',
    fallbacks: ['-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
    style: 'normal',
    weight: 400,
};

export const DEFAULT_MOTION_STYLE: MotionStyle = {
    fontFamily: 'system-ui',
    fontSize: 72,
    fontWeight: 400,
    fontStyle: 'normal',
    textCase: 'none',
    color: '#ffffff',
    opacity: 1,
    backgroundColor: null,
    backgroundPadding: 0,
};

export const DEFAULT_MOTION_TRANSFORM: MotionTransform = {
    anchorX: 'center',
    anchorY: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
};

export const TRACK_COLORS = [
    '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
    '#ba68c8', '#4dd0e1', '#aed581', '#ff8a65',
    '#f06292', '#7986cb',
] as const;
