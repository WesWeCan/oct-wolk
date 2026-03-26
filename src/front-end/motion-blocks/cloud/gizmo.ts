import type { MotionTrack } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import { resolveSafeAreaRegion } from '@/front-end/motion-blocks/core/safeArea';

/**
 * The cloud gizmo IS the constraint region — no block transform layer.
 * Returned bounds match the safe-area inset so the blue gizmo box
 * sits exactly where words are confined.
 */
export function getCloudFallbackBounds(
    track: MotionTrack,
    renderWidth: number,
    renderHeight: number,
): RendererBounds {
    const region = resolveSafeAreaRegion(track.block.style, renderWidth, renderHeight);
    const referenceX = region.left + region.width / 2;
    const referenceY = region.top + region.height / 2;

    return {
        x: region.left,
        y: region.top,
        width: region.width,
        height: region.height,
        referenceX,
        referenceY,
        localBoxX: -region.width / 2,
        localBoxY: -region.height / 2,
        localBoxWidth: region.width,
        localBoxHeight: region.height,
        rotation: 0,
        scale: 1,
    };
}

export function applyCloudGizmoDelta(
    track: MotionTrack,
    mode: 'move' | 'scale' | 'rotate',
    dx: number,
    dy: number,
    renderWidth: number,
    renderHeight: number,
) {
    const nextTrack: MotionTrack = JSON.parse(JSON.stringify(track));

    if (mode === 'move') {
        const currentX = nextTrack.block.style.safeAreaOffsetX ?? 0;
        const currentY = nextTrack.block.style.safeAreaOffsetY ?? 0;
        const padding = nextTrack.block.style.safeAreaPadding ?? 40;

        nextTrack.block.style.safeAreaOffsetX = Math.max(-padding, Math.min(padding, Math.round(currentX + dx)));
        nextTrack.block.style.safeAreaOffsetY = Math.max(-padding, Math.min(padding, Math.round(currentY + dy)));
        return {
            track: nextTrack,
            autoKeyframePaths: ['style.safeAreaOffsetX', 'style.safeAreaOffsetY'],
        };
    }

    if (mode === 'scale') {
        const currentPadding = nextTrack.block.style.safeAreaPadding ?? 40;
        const maxPadding = Math.max(0, Math.floor(Math.min(renderWidth, renderHeight) / 2));
        const newPadding = Math.max(0, Math.min(maxPadding, Math.round(currentPadding - dx)));
        nextTrack.block.style.safeAreaPadding = newPadding;

        const offsetX = nextTrack.block.style.safeAreaOffsetX ?? 0;
        const offsetY = nextTrack.block.style.safeAreaOffsetY ?? 0;
        nextTrack.block.style.safeAreaOffsetX = Math.max(-newPadding, Math.min(newPadding, offsetX));
        nextTrack.block.style.safeAreaOffsetY = Math.max(-newPadding, Math.min(newPadding, offsetY));
        return {
            track: nextTrack,
            autoKeyframePaths: ['style.safeAreaPadding'],
        };
    }

    // Rotation is a no-op — the constraint region isn't rotatable
    return {
        track: nextTrack,
        autoKeyframePaths: [] as string[],
    };
}
