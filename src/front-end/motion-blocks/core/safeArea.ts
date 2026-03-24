import type { AnchorX, AnchorY, MotionStyle } from '@/types/project_types';

export interface SafeAreaRegion {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

export const resolveSafeAreaRegion = (
    style: MotionStyle,
    renderWidth: number,
    renderHeight: number,
): SafeAreaRegion => {
    const useSafeArea = (style.boundsMode ?? 'safeArea') === 'safeArea';
    const left = useSafeArea ? (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetX ?? 0) : 0;
    const right = useSafeArea ? renderWidth - (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetX ?? 0) : renderWidth;
    const top = useSafeArea ? (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetY ?? 0) : 0;
    const bottom = useSafeArea ? renderHeight - (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetY ?? 0) : renderHeight;

    return {
        left,
        right,
        top,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
};

export const resolveReferencePointInRegion = (
    anchorX: AnchorX,
    anchorY: AnchorY,
    region: SafeAreaRegion,
) => {
    return {
        x: anchorX === 'left' ? region.left : anchorX === 'right' ? region.right : (region.left + region.right) / 2,
        y: anchorY === 'top' ? region.top : anchorY === 'bottom' ? region.bottom : (region.top + region.bottom) / 2,
    };
};

export const clampOffsetToConstraintRegion = (
    offset: number,
    anchor: AnchorX | AnchorY,
    padding: number,
    canvasSize: number,
    regionOffset = 0,
): number => {
    const min = padding + regionOffset;
    const max = canvasSize - padding + regionOffset;

    let anchorPos: number;
    if (anchor === 'left' || anchor === 'top') anchorPos = min;
    else if (anchor === 'right' || anchor === 'bottom') anchorPos = max;
    else anchorPos = (min + max) / 2;

    return Math.max(min - anchorPos, Math.min(max - anchorPos, offset));
};
