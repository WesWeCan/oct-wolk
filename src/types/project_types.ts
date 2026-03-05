// ---------------------------------------------------------------------------
// WolkProject v2 — Lyric-timeline-first data model
// See PRD-lyrics-motion-rebuild.md for full specification
// ---------------------------------------------------------------------------
import type { PropertyTrack } from '@/types/timeline_types';

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

// ---- Layer B: Motion Mode (redesigned) -----------------------------------

export type MotionBlockType = 'subtitle' | 'wordReveal' | 'paragraph';
export type MotionAnimationStyle =
    | 'fade'
    | 'slideUp'
    | 'slideDown'
    | 'slideLeft'
    | 'slideRight'
    | 'scale'
    | 'none';

export interface MotionEnterExit {
    fraction: number;
    minFrames: number;
    maxFrames: number;
    easing: string;
    style: MotionAnimationStyle;
    opacityStart: number;
    opacityEnd: number;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type WritingMode = 'horizontal' | 'vertical-rl' | 'vertical-lr';
export type BoundsMode = 'free' | 'safeArea';
export type WrapMode = 'none' | 'word' | 'balanced';
export type OverflowBehavior = 'none' | 'scaleDown' | 'ellipsis' | 'clip';

export interface MotionStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    fontStyle: 'normal' | 'italic' | 'oblique';
    underline: boolean;
    textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    letterSpacing: number;
    lineHeight: number;
    color: string;
    opacity: number;
    globalOpacity?: number;
    backgroundColor: string | null;
    backgroundOpacity?: number;
    backgroundPadding: number;
    backgroundBorderRadius?: number;
    textAlign?: TextAlign;
    writingMode?: WritingMode;
    outlineWidth?: number;
    outlineColor?: string;
    boundsMode?: BoundsMode;
    wrapMode?: WrapMode;
    maxLines?: number;
    overflowBehavior?: OverflowBehavior;
    safeAreaPadding?: number;
    safeAreaOffsetX?: number;
    safeAreaOffsetY?: number;
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

export interface ItemOverride {
    sourceItemId: string;
    hidden: boolean;
    textOverride?: string;
    styleOverride?: Partial<MotionStyle>;
    transformOverride?: Partial<MotionTransform>;
    enterOverride?: Partial<MotionEnterExit>;
    exitOverride?: Partial<MotionEnterExit>;
    wordStyleMap?: Record<number, Partial<MotionStyle>>;
}

export interface MotionBlock {
    id: string;
    type: MotionBlockType;
    sourceTrackId: string;
    startMs: number;
    endMs: number;
    style: MotionStyle;
    transform: MotionTransform;
    enter: MotionEnterExit;
    exit: MotionEnterExit;
    overrides: ItemOverride[];
    params: Record<string, any>;
    propertyTracks: PropertyTrack[];
}

export interface MotionTrack {
    id: string;
    name: string;
    color: string;
    enabled: boolean;
    muted: boolean;
    solo: boolean;
    locked: boolean;
    collapsed: boolean;
    block: MotionBlock;
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
    durationMs: number;
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
    motionTracks: MotionTrack[];
    backgroundImage?: string;
    backgroundColor: string;
    backgroundImageFit: 'cover' | 'contain' | 'stretch';
    createdAt: number;
    updatedAt: number;
}

// ---- Defaults -------------------------------------------------------------

export const DEFAULT_PROJECT_SETTINGS: WolkProjectSettings = {
    fps: 60,
    renderWidth: 1920,
    renderHeight: 1080,
    seed: 'wolk-default',
    durationMs: 30_000,
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
    underline: false,
    textCase: 'none',
    letterSpacing: 0,
    lineHeight: 1.2,
    color: '#ffffff',
    opacity: 1,
    globalOpacity: 1,
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    backgroundPadding: 0,
    backgroundBorderRadius: 0,
    textAlign: 'center',
    writingMode: 'horizontal',
    outlineWidth: 0,
    outlineColor: '#000000',
    boundsMode: 'safeArea',
    wrapMode: 'word',
    maxLines: 5,
    overflowBehavior: 'none',
    safeAreaPadding: 40,
    safeAreaOffsetX: 0,
    safeAreaOffsetY: 0,
};

export const DEFAULT_MOTION_TRANSFORM: MotionTransform = {
    anchorX: 'center',
    anchorY: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
};

export const DEFAULT_MOTION_ENTER_EXIT: MotionEnterExit = {
    fraction: 0.3,
    minFrames: 3,
    maxFrames: 30,
    easing: 'easeOut',
    style: 'fade',
    opacityStart: 0,
    opacityEnd: 1,
};

export const TRACK_COLORS = [
    '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
    '#ba68c8', '#4dd0e1', '#aed581', '#ff8a65',
    '#f06292', '#7986cb',
] as const;
