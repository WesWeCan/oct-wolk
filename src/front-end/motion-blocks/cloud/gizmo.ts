import type { MotionTrack } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import {
    clampOffsetToConstraintRegion,
    resolveReferencePointInRegion,
    resolveSafeAreaRegion,
} from '@/front-end/motion-blocks/core/safeArea';

const resolveLocalBox = (track: MotionTrack, renderWidth: number, renderHeight: number) => {
    const region = resolveSafeAreaRegion(track.block.style, renderWidth, renderHeight);
    const localBoxWidth = region.width;
    const localBoxHeight = region.height;
    const anchorLocalX = track.block.transform.anchorX === 'left'
        ? 0
        : track.block.transform.anchorX === 'right'
            ? localBoxWidth
            : localBoxWidth / 2;
    const anchorLocalY = track.block.transform.anchorY === 'top'
        ? 0
        : track.block.transform.anchorY === 'bottom'
            ? localBoxHeight
            : localBoxHeight / 2;

    return {
        localBoxX: -anchorLocalX,
        localBoxY: -anchorLocalY,
        localBoxWidth,
        localBoxHeight,
    };
};

const computeRectAabb = (
    localBoxX: number,
    localBoxY: number,
    localBoxWidth: number,
    localBoxHeight: number,
    rotationDeg: number,
    scale: number,
    referenceX: number,
    referenceY: number,
) => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
        { x: localBoxX, y: localBoxY },
        { x: localBoxX + localBoxWidth, y: localBoxY },
        { x: localBoxX, y: localBoxY + localBoxHeight },
        { x: localBoxX + localBoxWidth, y: localBoxY + localBoxHeight },
    ].map((corner) => ({
        x: referenceX + ((corner.x * cos - corner.y * sin) * scale),
        y: referenceY + ((corner.x * sin + corner.y * cos) * scale),
    }));

    const minX = Math.min(...corners.map((corner) => corner.x));
    const maxX = Math.max(...corners.map((corner) => corner.x));
    const minY = Math.min(...corners.map((corner) => corner.y));
    const maxY = Math.max(...corners.map((corner) => corner.y));

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
};

export function getCloudFallbackBounds(
    track: MotionTrack,
    renderWidth: number,
    renderHeight: number,
): RendererBounds {
    const transform = track.block.transform;
    const region = resolveSafeAreaRegion(track.block.style, renderWidth, renderHeight);
    const base = resolveReferencePointInRegion(transform.anchorX, transform.anchorY, region);
    const referenceX = base.x + transform.offsetX;
    const referenceY = base.y + transform.offsetY;
    const localBox = resolveLocalBox(track, renderWidth, renderHeight);
    const aabb = computeRectAabb(
        localBox.localBoxX,
        localBox.localBoxY,
        localBox.localBoxWidth,
        localBox.localBoxHeight,
        transform.rotation,
        transform.scale,
        referenceX,
        referenceY,
    );

    return {
        ...aabb,
        referenceX,
        referenceY,
        localBoxX: localBox.localBoxX,
        localBoxY: localBox.localBoxY,
        localBoxWidth: localBox.localBoxWidth,
        localBoxHeight: localBox.localBoxHeight,
        rotation: transform.rotation,
        scale: transform.scale,
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
