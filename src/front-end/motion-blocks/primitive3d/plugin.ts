import {
    createDefaultPrimitive3DEnter,
    createDefaultPrimitive3DExit,
    DEFAULT_PRIMITIVE3D_STYLE,
    DEFAULT_PRIMITIVE3D_TRANSFORM,
} from '@/front-end/motion-blocks/primitive3d/defaults';
import { collectPrimitive3DFonts } from '@/front-end/motion-blocks/primitive3d/fonts';
import { normalizePrimitive3DTrack } from '@/front-end/motion-blocks/primitive3d/normalize';
import {
    cleanPrimitive3DOrphanedOverrides,
    resolvePrimitive3DActiveItems,
    resolvePrimitive3DBlockItems,
} from '@/front-end/motion-blocks/primitive3d/item-resolvers';
import { PRIMITIVE3D_KEYFRAME_PROPERTIES } from '@/front-end/motion-blocks/primitive3d/keyframes';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { primitive3dMotionPresetAdapter } from '@/front-end/motion-blocks/primitive3d/presets';
import { applyPrimitive3DGizmoDelta, getPrimitive3DFallbackBounds } from '@/front-end/motion-blocks/primitive3d/gizmo';
import { Primitive3DRenderer } from '@/front-end/motion-blocks/primitive3d/renderer/Primitive3DRenderer';
import type { MotionBlockPlugin } from '@/front-end/motion-blocks/core/plugin-types';
import Primitive3DInspector from '@/front-end/motion-blocks/primitive3d/inspector/Primitive3DInspector.vue';

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
    normalizeTrack(track, args) {
        return normalizePrimitive3DTrack(track, args);
    },
    createRenderer() {
        return new Primitive3DRenderer();
    },
    resolveActiveItems: resolvePrimitive3DActiveItems,
    resolveBlockItems: resolvePrimitive3DBlockItems,
    cleanOrphanedOverrides: cleanPrimitive3DOrphanedOverrides,
    collectFonts: collectPrimitive3DFonts,
    getKeyframeProperties: () => PRIMITIVE3D_KEYFRAME_PROPERTIES,
    presets: primitive3dMotionPresetAdapter,
    inspectorComponent: Primitive3DInspector,
    gizmo: {
        getFallbackBounds: getPrimitive3DFallbackBounds,
        applyDelta(track, mode, dx, dy, context) {
            return applyPrimitive3DGizmoDelta(track, mode, dx, dy, context);
        },
        supportsSafeAreaGuide: false,
    },
};
