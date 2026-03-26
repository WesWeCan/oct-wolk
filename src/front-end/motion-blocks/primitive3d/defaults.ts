import type { MotionEnterExit, MotionStyle, MotionTransform } from '@/types/project_types';

export const DEFAULT_PRIMITIVE3D_STYLE: MotionStyle = {
    fontFamily: 'system-ui',
    fontFallbacks: [],
    fontSize: 72,
    fontWeight: 400,
    fontStyle: 'normal',
    fontName: undefined,
    fontLocalPath: undefined,
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
    wrapMode: 'none',
    maxLines: 1,
    overflowBehavior: 'none',
    safeAreaPadding: 40,
    safeAreaOffsetX: 0,
    safeAreaOffsetY: 0,
};

export const DEFAULT_PRIMITIVE3D_TRANSFORM: MotionTransform = {
    anchorX: 'center',
    anchorY: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
};

const NOOP_FADE = {
    enabled: false,
    opacityStart: 1,
    opacityEnd: 1,
};

const NOOP_MOVE = {
    enabled: false,
    direction: 'up' as const,
    distancePx: 0,
};

const NOOP_SCALE = {
    enabled: false,
    amount: 0,
};

export const DEFAULT_PRIMITIVE3D_ENTER_EXIT: MotionEnterExit = {
    fraction: 0.2,
    minFrames: 1,
    maxFrames: 24,
    easing: 'linear',
    showCursor: false,
    fade: { ...NOOP_FADE },
    move: { ...NOOP_MOVE },
    scale: { ...NOOP_SCALE },
    style: 'none',
    opacityStart: 1,
    opacityEnd: 1,
};

export const createDefaultPrimitive3DEnter = (): MotionEnterExit => ({
    ...DEFAULT_PRIMITIVE3D_ENTER_EXIT,
    fade: { ...NOOP_FADE },
    move: { ...NOOP_MOVE },
    scale: { ...NOOP_SCALE },
});

export const createDefaultPrimitive3DExit = (): MotionEnterExit => ({
    ...DEFAULT_PRIMITIVE3D_ENTER_EXIT,
    fade: { ...NOOP_FADE },
    move: { ...NOOP_MOVE },
    scale: { ...NOOP_SCALE },
});
