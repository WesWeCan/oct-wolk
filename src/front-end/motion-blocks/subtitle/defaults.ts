import type { MotionEnterExit, MotionStyle, MotionTransform } from '@/types/project_types';

export const DEFAULT_SUBTITLE_STYLE: MotionStyle = {
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
    wrapMode: 'word',
    maxLines: 5,
    overflowBehavior: 'none',
    safeAreaPadding: 40,
    safeAreaOffsetX: 0,
    safeAreaOffsetY: 0,
};

export const DEFAULT_SUBTITLE_TRANSFORM: MotionTransform = {
    anchorX: 'center',
    anchorY: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
};

export const DEFAULT_SUBTITLE_ENTER_EXIT: MotionEnterExit = {
    fraction: 0.3,
    minFrames: 3,
    maxFrames: 30,
    easing: 'easeOut',
    fade: {
        enabled: true,
        opacityStart: 0,
        opacityEnd: 1,
    },
    move: {
        enabled: false,
        direction: 'up',
        distancePx: 24,
    },
    scale: {
        enabled: false,
        amount: 0.12,
    },
    style: 'fade',
    opacityStart: 0,
    opacityEnd: 1,
};

export function createDefaultSubtitleEnter(): MotionEnterExit {
    return {
        ...DEFAULT_SUBTITLE_ENTER_EXIT,
        fade: { ...DEFAULT_SUBTITLE_ENTER_EXIT.fade, enabled: true, opacityStart: 0, opacityEnd: 1 },
        move: { ...DEFAULT_SUBTITLE_ENTER_EXIT.move },
        scale: { ...DEFAULT_SUBTITLE_ENTER_EXIT.scale },
        opacityStart: 0,
        opacityEnd: 1,
    };
}

export function createDefaultSubtitleExit(): MotionEnterExit {
    return {
        ...DEFAULT_SUBTITLE_ENTER_EXIT,
        fade: { ...DEFAULT_SUBTITLE_ENTER_EXIT.fade, enabled: true, opacityStart: 1, opacityEnd: 0 },
        move: { ...DEFAULT_SUBTITLE_ENTER_EXIT.move },
        scale: { ...DEFAULT_SUBTITLE_ENTER_EXIT.scale },
        opacityStart: 1,
        opacityEnd: 0,
    };
}
