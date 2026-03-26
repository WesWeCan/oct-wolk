import {
    createDefaultPrimitive3DEnter,
    createDefaultPrimitive3DExit,
    DEFAULT_PRIMITIVE3D_STYLE,
    DEFAULT_PRIMITIVE3D_TRANSFORM,
} from '@/front-end/motion-blocks/primitive3d/defaults';
import {
    cleanPrimitive3DOrphanedOverrides,
    resolvePrimitive3DActiveItems,
    resolvePrimitive3DBlockItems,
} from '@/front-end/motion-blocks/primitive3d/item-resolvers';
import { PRIMITIVE3D_KEYFRAME_PROPERTIES } from '@/front-end/motion-blocks/primitive3d/keyframes';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { applyPrimitive3DGizmoDelta, getPrimitive3DFallbackBounds } from '@/front-end/motion-blocks/primitive3d/gizmo';
import { Primitive3DRenderer } from '@/front-end/motion-blocks/primitive3d/renderer/Primitive3DRenderer';
import type { MotionBlockPlugin } from '@/front-end/motion-blocks/core/plugin-types';
import Primitive3DInspector from '@/front-end/motion-blocks/primitive3d/inspector/Primitive3DInspector.vue';
import type { MotionTrack } from '@/types/project_types';

const LEGACY_PIXELS_TO_WORLD = 0.01;
const primitive3DKeyframePaths = new Set(PRIMITIVE3D_KEYFRAME_PROPERTIES.map((property) => property.path));

const collapseLegacyTransformIntoParams = (track: MotionTrack) => {
    const params = resolvePrimitive3DParams(track.block.params);
    const transform = track.block.transform || DEFAULT_PRIMITIVE3D_TRANSFORM;
    const isIdentityTransform = (
        transform.offsetX === 0
        && transform.offsetY === 0
        && transform.scale === 1
        && transform.rotation === 0
        && transform.anchorX === 'center'
        && transform.anchorY === 'center'
    );

    if (isIdentityTransform) return params;

    return resolvePrimitive3DParams({
        ...params,
        object: {
            ...params.object,
            positionX: params.object.positionX + (transform.offsetX * LEGACY_PIXELS_TO_WORLD),
            positionY: params.object.positionY - (transform.offsetY * LEGACY_PIXELS_TO_WORLD),
            rotationZ: params.object.rotationZ + transform.rotation,
            scale: params.object.scale * Math.max(0.05, transform.scale || 1),
        },
    });
};

export const primitive3dMotionBlockPlugin: MotionBlockPlugin = {
    type: 'primitive3d',
    meta: {
        label: '3D Primitive',
        description: 'Renders a full-frame keyframeable Three.js primitive with shared or local lighting.',
        authorable: true,
        order: 3,
        requiresSourceTrack: false,
        ignoreSolo: true,
        renderSpace: '3d',
        supportsMonitorGizmo: false,
    },
    createTrack({ startMs, endMs, color, trackId, blockId }) {
        return {
            id: trackId,
            name: '3d primitive',
            color,
            enabled: true,
            muted: false,
            solo: false,
            locked: false,
            collapsed: false,
            block: {
                id: blockId,
                type: 'primitive3d',
                sourceTrackId: '',
                startMs,
                endMs,
                style: { ...DEFAULT_PRIMITIVE3D_STYLE },
                transform: { ...DEFAULT_PRIMITIVE3D_TRANSFORM },
                enter: createDefaultPrimitive3DEnter(),
                exit: createDefaultPrimitive3DExit(),
                overrides: [],
                params: resolvePrimitive3DParams(undefined) as any,
                propertyTracks: [],
            },
        };
    },
    normalizeTrack(track) {
        const propertyTracks = (track.block.propertyTracks || []).filter((propertyTrack) => {
            if (!propertyTrack || propertyTrack.enabled === false) return false;
            if (!primitive3DKeyframePaths.has(propertyTrack.propertyPath)) return false;
            return Array.isArray(propertyTrack.keyframes) && propertyTrack.keyframes.length > 0;
        });

        return {
            ...track,
            enabled: track.enabled !== false,
            muted: !!track.muted,
            solo: !!track.solo,
            locked: !!track.locked,
            block: {
                ...track.block,
                type: 'primitive3d',
                sourceTrackId: '',
                style: {
                    ...DEFAULT_PRIMITIVE3D_STYLE,
                    ...(track.block.style || {}),
                },
                // Collapse the old 2D wrapper into object-space params once, then keep the wrapper neutral.
                transform: { ...DEFAULT_PRIMITIVE3D_TRANSFORM },
                params: collapseLegacyTransformIntoParams(track) as any,
                propertyTracks,
            },
        };
    },
    createRenderer() {
        return new Primitive3DRenderer();
    },
    resolveActiveItems: resolvePrimitive3DActiveItems,
    resolveBlockItems: resolvePrimitive3DBlockItems,
    cleanOrphanedOverrides: cleanPrimitive3DOrphanedOverrides,
    getKeyframeProperties: () => PRIMITIVE3D_KEYFRAME_PROPERTIES,
    inspectorComponent: Primitive3DInspector,
    gizmo: {
        getFallbackBounds: getPrimitive3DFallbackBounds,
        applyDelta(track, mode, dx, dy, context) {
            return applyPrimitive3DGizmoDelta(track, mode, dx, dy, context);
        },
        supportsSafeAreaGuide: false,
    },
};
