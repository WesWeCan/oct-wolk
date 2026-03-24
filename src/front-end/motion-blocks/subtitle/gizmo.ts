import type { MotionTrack } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import {
    clampOffsetToConstraintRegion,
    resolveReferencePointInRegion,
    resolveSafeAreaRegion,
} from '@/front-end/motion-blocks/core/safeArea';

export function getSubtitleFallbackBounds(
    track: MotionTrack,
    renderWidth: number,
    renderHeight: number,
): RendererBounds {
    const t = track.block.transform;
    const s = track.block.style;
    const region = resolveSafeAreaRegion(s, renderWidth, renderHeight);
    const base = resolveReferencePointInRegion(t.anchorX, t.anchorY, region);
    let referenceX = base.x;
    let referenceY = base.y;
    referenceX += t.offsetX;
    referenceY += t.offsetY;

    const approxWidth = Math.max(40, s.fontSize * 8);
    const approxHeight = Math.max(s.fontSize, s.fontSize * s.lineHeight);
    const pad = Math.max(0, s.backgroundPadding ?? 0);
    const localBoxX = t.anchorX === 'left' ? 0 : t.anchorX === 'right' ? -approxWidth - pad * 2 : -((approxWidth + pad * 2) / 2);
    const localBoxY = t.anchorY === 'top' ? 0 : t.anchorY === 'bottom' ? -approxHeight - pad * 2 : -((approxHeight + pad * 2) / 2);

    return {
        x: referenceX + localBoxX * t.scale,
        y: referenceY + localBoxY * t.scale,
        width: (approxWidth + pad * 2) * t.scale,
        height: (approxHeight + pad * 2) * t.scale,
        referenceX,
        referenceY,
        localBoxX,
        localBoxY,
        localBoxWidth: approxWidth + pad * 2,
        localBoxHeight: approxHeight + pad * 2,
        rotation: t.rotation,
        scale: t.scale,
    };
}

export function applySubtitleGizmoDelta(
    track: MotionTrack,
    mode: 'move' | 'scale' | 'rotate',
    dx: number,
    dy: number,
    renderWidth: number,
    renderHeight: number,
) {
    const nextTrack: MotionTrack = JSON.parse(JSON.stringify(track));
    const transform = nextTrack.block.transform;

    if (mode === 'move') {
        const rot = -(transform.rotation * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const localDx = dx * cos - dy * sin;
        const localDy = dx * sin + dy * cos;

        let newOffsetX = Math.round(transform.offsetX + localDx);
        let newOffsetY = Math.round(transform.offsetY + localDy);

        if ((nextTrack.block.style.boundsMode ?? 'safeArea') === 'safeArea') {
            const padding = nextTrack.block.style.safeAreaPadding ?? 40;
            const regionOffsetX = nextTrack.block.style.safeAreaOffsetX ?? 0;
            const regionOffsetY = nextTrack.block.style.safeAreaOffsetY ?? 0;
            newOffsetX = clampOffsetToConstraintRegion(newOffsetX, transform.anchorX, padding, renderWidth, regionOffsetX);
            newOffsetY = clampOffsetToConstraintRegion(newOffsetY, transform.anchorY, padding, renderHeight, regionOffsetY);
        }

        transform.offsetX = newOffsetX;
        transform.offsetY = newOffsetY;
        return {
            track: nextTrack,
            autoKeyframePaths: ['transform.offsetX', 'transform.offsetY'],
        };
    }

    if (mode === 'scale') {
        transform.scale = Math.max(0.05, Math.min(10, transform.scale + dx * 0.005));
        return {
            track: nextTrack,
            autoKeyframePaths: ['transform.scale'],
        };
    }

    transform.rotation += dx;
    return {
        track: nextTrack,
        autoKeyframePaths: ['transform.rotation'],
    };
}
