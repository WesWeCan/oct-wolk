import {
    createDefaultPrimitive3DEnter,
    createDefaultPrimitive3DExit,
    DEFAULT_PRIMITIVE3D_STYLE,
    DEFAULT_PRIMITIVE3D_TRANSFORM,
} from '@/front-end/motion-blocks/primitive3d/defaults';
import { collectPrimitive3DFonts } from '@/front-end/motion-blocks/primitive3d/fonts';
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
import { normalizeSubtitleEnterExit } from '@/front-end/motion-blocks/subtitle/defaults';
import type { MotionTrack, WolkProjectFont } from '@/types/project_types';

const LEGACY_PIXELS_TO_WORLD = 0.01;
const primitive3DKeyframePaths = new Set(PRIMITIVE3D_KEYFRAME_PROPERTIES.map((property) => property.path));

function inheritProjectFont(track: MotionTrack, projectFont?: WolkProjectFont) {
    const style = track.block.style || { ...DEFAULT_PRIMITIVE3D_STYLE };
    const shouldInheritProjectFont = !style.fontLocalPath && (
        !style.fontFamily
        || style.fontFamily === projectFont?.family
        || style.fontFamily === 'ProjectFont'
    );

    return {
        ...DEFAULT_PRIMITIVE3D_STYLE,
        ...style,
        fontFallbacks: style.fontFallbacks ?? (shouldInheritProjectFont ? projectFont?.fallbacks || [] : []),
        fontName: style.fontName ?? (shouldInheritProjectFont ? projectFont?.name : undefined),
        fontLocalPath: style.fontLocalPath ?? (shouldInheritProjectFont ? projectFont?.localPath : undefined),
    };
}

const collapseLegacyTransformIntoParams = (
    track: MotionTrack,
    enter = track.block.enter,
    exit = track.block.exit,
) => {
    const params = resolvePrimitive3DParams(track.block.params, enter, exit);
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
    createTrack({ project, sourceTrack, startMs, endMs, color, trackId, blockId }) {
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
                sourceTrackId: sourceTrack?.id || '',
                startMs,
                endMs,
                style: {
                    ...DEFAULT_PRIMITIVE3D_STYLE,
                    fontFamily: project.font.family || DEFAULT_PRIMITIVE3D_STYLE.fontFamily,
                    fontFallbacks: [...(project.font.fallbacks || [])],
                    fontStyle: project.font.style || DEFAULT_PRIMITIVE3D_STYLE.fontStyle,
                    fontWeight: project.font.weight || DEFAULT_PRIMITIVE3D_STYLE.fontWeight,
                    fontName: project.font.name,
                    fontLocalPath: project.font.localPath,
                },
                transform: { ...DEFAULT_PRIMITIVE3D_TRANSFORM },
                enter: createDefaultPrimitive3DEnter(),
                exit: createDefaultPrimitive3DExit(),
                overrides: [],
                params: resolvePrimitive3DParams(undefined) as any,
                propertyTracks: [],
            },
        };
    },
    normalizeTrack(track, { projectFont }) {
        const propertyTracks = (track.block.propertyTracks || []).filter((propertyTrack) => {
            if (!propertyTrack || propertyTrack.enabled === false) return false;
            if (!primitive3DKeyframePaths.has(propertyTrack.propertyPath)) return false;
            return Array.isArray(propertyTrack.keyframes) && propertyTrack.keyframes.length > 0;
        });
        const enter = normalizeSubtitleEnterExit(track.block.enter, 'enter');
        const exit = normalizeSubtitleEnterExit(track.block.exit, 'exit');

        return {
            ...track,
            enabled: track.enabled !== false,
            muted: !!track.muted,
            solo: !!track.solo,
            locked: !!track.locked,
            block: {
                ...track.block,
                type: 'primitive3d',
                sourceTrackId: typeof track.block.sourceTrackId === 'string' ? track.block.sourceTrackId : '',
                style: inheritProjectFont(track, projectFont),
                enter,
                exit,
                // Collapse the old 2D wrapper into object-space params once, then keep the wrapper neutral.
                transform: { ...DEFAULT_PRIMITIVE3D_TRANSFORM },
                params: collapseLegacyTransformIntoParams(track, enter, exit) as any,
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
    collectFonts: collectPrimitive3DFonts,
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
