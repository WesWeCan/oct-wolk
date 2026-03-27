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

const DEFAULT_FADE = {
    enabled: true,
    opacityStart: 0,
    opacityEnd: 1,
};

const NOOP_MOVE = {
    enabled: false,
    direction: 'up' as const,
    distancePx: 24,
};

const NOOP_SCALE = {
    enabled: false,
    amount: 0.12,
};

export const DEFAULT_PRIMITIVE3D_ENTER_EXIT: MotionEnterExit = {
    fraction: 0.3,
    minFrames: 3,
    maxFrames: 30,
    easing: 'easeOut',
    showCursor: false,
    fade: { ...DEFAULT_FADE },
    move: { ...NOOP_MOVE },
    scale: { ...NOOP_SCALE },
    style: 'fade',
    opacityStart: 0,
    opacityEnd: 1,
};

export const createDefaultPrimitive3DEnter = (): MotionEnterExit => ({
    ...DEFAULT_PRIMITIVE3D_ENTER_EXIT,
    fade: { ...DEFAULT_FADE, enabled: true, opacityStart: 0, opacityEnd: 1 },
    move: { ...NOOP_MOVE },
    scale: { ...NOOP_SCALE },
    opacityStart: 0,
    opacityEnd: 1,
});

export const createDefaultPrimitive3DExit = (): MotionEnterExit => ({
    ...DEFAULT_PRIMITIVE3D_ENTER_EXIT,
    fade: { ...DEFAULT_FADE, enabled: true, opacityStart: 1, opacityEnd: 0 },
    move: { ...NOOP_MOVE },
    scale: { ...NOOP_SCALE },
    opacityStart: 1,
    opacityEnd: 0,
});
