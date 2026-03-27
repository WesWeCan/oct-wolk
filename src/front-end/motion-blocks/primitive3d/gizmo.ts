import type { MotionTrack } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';

const DEFAULT_CAMERA_DISTANCE = 5.5;

const getFallbackShapeSize = (params: ReturnType<typeof resolvePrimitive3DParams>): { width: number; height: number } => {
    switch (params.primitive.type) {
    case 'box':
        return { width: params.primitive.boxWidth, height: params.primitive.boxHeight };
    case 'plane':
        return { width: params.primitive.planeWidth, height: params.primitive.planeHeight };
    case 'cylinder':
        return {
            width: Math.max(params.primitive.cylinderRadiusTop, params.primitive.cylinderRadiusBottom) * 2,
            height: params.primitive.cylinderHeight,
        };
    case 'cone':
        return { width: params.primitive.coneRadius * 2, height: params.primitive.coneHeight };
    case 'torus':
        return {
            width: (params.primitive.torusRadius * 2) + (params.primitive.torusTube * 2),
            height: (params.primitive.torusRadius * 2) + (params.primitive.torusTube * 2),
        };
    case 'capsule':
        return {
            width: params.primitive.capsuleRadius * 2,
            height: params.primitive.capsuleLength + (params.primitive.capsuleRadius * 2),
        };
    case 'model':
        return {
            width: params.primitive.modelBoundsWidth,
            height: params.primitive.modelBoundsHeight,
        };
    default:
        return { width: 2, height: 2 };
    }
};

const buildRendererBoundsFromRect = (
    x: number,
    y: number,
    width: number,
    height: number,
): RendererBounds => {
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const referenceX = x + (nextWidth / 2);
    const referenceY = y + (nextHeight / 2);

    return {
        x,
        y,
        width: nextWidth,
        height: nextHeight,
        referenceX,
        referenceY,
        localBoxX: -(nextWidth / 2),
        localBoxY: -(nextHeight / 2),
        localBoxWidth: nextWidth,
        localBoxHeight: nextHeight,
        rotation: 0,
        scale: 1,
    };
};

export const getPrimitive3DFallbackBounds = (
    track: MotionTrack,
    renderWidth: number,
    renderHeight: number,
): RendererBounds => {
    const params = resolvePrimitive3DParams(track.block.params);
    const baseSize = Math.min(renderWidth, renderHeight) * 0.45;
    const effectiveDistance = Math.max(1, params.camera.distance - params.object.positionZ);
    const projectedSize = baseSize * params.object.scale * (DEFAULT_CAMERA_DISTANCE / effectiveDistance);
    const shapeSize = getFallbackShapeSize(params);
    const maxShapeDimension = Math.max(shapeSize.width, shapeSize.height, 0.0001);
    const projectedWidth = projectedSize * (shapeSize.width / maxShapeDimension);
    const projectedHeight = projectedSize * (shapeSize.height / maxShapeDimension);
    const centerX = (renderWidth / 2) + (params.object.positionX * renderWidth * 0.08);
    const centerY = (renderHeight / 2) - (params.object.positionY * renderHeight * 0.08);

    return buildRendererBoundsFromRect(
        centerX - (projectedWidth / 2),
        centerY - (projectedHeight / 2),
        projectedWidth,
        projectedHeight,
    );
};

export const applyPrimitive3DGizmoDelta = (
    track: MotionTrack,
    mode: 'move' | 'scale' | 'rotate',
    dx: number,
    dy: number,
    context: {
        renderWidth: number;
        renderHeight: number;
        currentBounds: RendererBounds | null;
        currentFrame: number;
    },
) => {
    const nextTrack: MotionTrack = JSON.parse(JSON.stringify(track));
    const params = resolvePrimitive3DParams(nextTrack.block.params);
    const dominantRenderSize = Math.max(1, Math.max(context.renderWidth, context.renderHeight));
    const worldUnitsPerPixel = Math.max(0.003, (params.camera.distance / dominantRenderSize) * 3.5);

    if (mode === 'move') {
        params.object.positionX += dx * worldUnitsPerPixel;
        params.object.positionY -= dy * worldUnitsPerPixel;
        nextTrack.block.params = params as any;
        return {
            track: nextTrack,
            autoKeyframePaths: ['params.object.positionX', 'params.object.positionY'],
        };
    }

    if (mode === 'scale') {
        params.object.scale = Math.max(0.05, Math.min(10, params.object.scale + ((dx - dy) * 0.005)));
        nextTrack.block.params = params as any;
        return {
            track: nextTrack,
            autoKeyframePaths: ['params.object.scale'],
        };
    }

    params.object.rotationZ = Math.max(-360, Math.min(360, params.object.rotationZ + dx));
    nextTrack.block.params = params as any;
    return {
        track: nextTrack,
        autoKeyframePaths: ['params.object.rotationZ'],
    };
};
