// ---------------------------------------------------------------------------
// WolkProject v2 — Lyric-timeline-first data model
// See PRD-lyrics-motion-rebuild.md for full specification
// ---------------------------------------------------------------------------
import type { PropertyTrack } from '@/types/keyframe_types';

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

export type MotionBlockType = string;
export type MotionAnimationStyle =
    | 'fade'
    | 'slideUp'
    | 'slideDown'
    | 'slideLeft'
    | 'slideRight'
    | 'scale'
    | 'typewriter'
    | 'none';

export type MotionAnimationDirection = 'up' | 'down' | 'left' | 'right';
export type MotionAnimationEasing =
    | 'linear'
    | 'easeIn'
    | 'easeOut'
    | 'easeInOut'
    | 'easeInCubic'
    | 'easeOutCubic'
    | 'easeOutBack'
    | 'easeInBack'
    | 'easeOutBounce'
    | 'easeInBounce';

export interface MotionFadeAnimation {
    enabled: boolean;
    opacityStart: number;
    opacityEnd: number;
}

export interface MotionMoveAnimation {
    enabled: boolean;
    direction: MotionAnimationDirection;
    distancePx: number;
}

export interface MotionScaleAnimation {
    enabled: boolean;
    amount: number;
}

export interface MotionEnterExit {
    fraction: number;
    minFrames: number;
    maxFrames: number;
    easing: MotionAnimationEasing;
    showCursor?: boolean;
    fade: MotionFadeAnimation;
    move: MotionMoveAnimation;
    scale: MotionScaleAnimation;
    // Legacy fields kept for backwards compatibility with saved projects.
    style?: MotionAnimationStyle;
    opacityStart?: number;
    opacityEnd?: number;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type WritingMode = 'horizontal' | 'vertical-rl' | 'vertical-lr';
export type BoundsMode = 'free' | 'safeArea';
export type WrapMode = 'none' | 'word' | 'balanced';
export type OverflowBehavior = 'none' | 'scaleDown' | 'ellipsis' | 'clip';

export interface MotionStyle {
    fontFamily: string;
    fontFallbacks?: string[];
    fontSize: number;
    fontWeight: number;
    fontStyle: 'normal' | 'italic' | 'oblique';
    fontName?: string;
    fontLocalPath?: string;
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
    // `safeArea` remains the persisted backing name for the user-facing Constraint Region mode.
    boundsMode?: BoundsMode;
    wrapMode?: WrapMode;
    maxLines?: number;
    overflowBehavior?: OverflowBehavior;
    // Persisted backing fields for the user-facing Constraint Region controls.
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

export interface Scene3DGlobalLighting {
    ambientColor: string;
    ambientIntensity: number;
    directionalColor: string;
    directionalIntensity: number;
    directionalAzimuth: number;
    directionalElevation: number;
}

export interface Scene3DSettings {
    enabled: boolean;
    globalLighting: Scene3DGlobalLighting;
}

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
    keepRawPngFrames?: boolean;
    exportAlphaMov?: boolean;
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
    backgroundVisible?: boolean;
    backgroundImageVisible?: boolean;
    backgroundImage?: string;
    backgroundColor: string;
    backgroundColorOpacity?: number;
    backgroundUseGradient?: boolean;
    backgroundGradientColor?: string;
    backgroundGradientAngle?: number;
    backgroundImageFit: 'cover' | 'contain' | 'stretch';
    backgroundImageX?: number;
    backgroundImageY?: number;
    backgroundImageScale?: number;
    backgroundImageOpacity?: number;
    scene3d?: Scene3DSettings;
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
    keepRawPngFrames: false,
    exportAlphaMov: false,
};

export const DEFAULT_PROJECT_FONT: WolkProjectFont = {
    family: 'system-ui',
    fallbacks: ['-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
    style: 'normal',
    weight: 400,
};

export const DEFAULT_SCENE3D_GLOBAL_LIGHTING: Scene3DGlobalLighting = {
    ambientColor: '#ffffff',
    ambientIntensity: 0.45,
    directionalColor: '#ffffff',
    directionalIntensity: 1.2,
    directionalAzimuth: 35,
    directionalElevation: 50,
};

export const DEFAULT_SCENE3D_SETTINGS: Scene3DSettings = {
    enabled: false,
    globalLighting: { ...DEFAULT_SCENE3D_GLOBAL_LIGHTING },
};


export const TRACK_COLORS = [
    '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
    '#ba68c8', '#4dd0e1', '#aed581', '#ff8a65',
    '#f06292', '#7986cb',
] as const;
