import {
    createDefaultCloudEnter,
    createDefaultCloudExit,
    DEFAULT_CLOUD_PARAMS,
    DEFAULT_CLOUD_STYLE,
    DEFAULT_CLOUD_TRANSFORM,
} from '@/front-end/motion-blocks/cloud/defaults';
import { collectCloudFonts } from '@/front-end/motion-blocks/cloud/fonts';
import {
    cleanCloudOrphanedOverrides,
    resolveCloudActiveItems,
    resolveCloudBlockItems,
} from '@/front-end/motion-blocks/cloud/item-resolvers';
import { CLOUD_KEYFRAME_PROPERTIES } from '@/front-end/motion-blocks/cloud/keyframes';
import { applyCloudGizmoDelta, getCloudFallbackBounds } from '@/front-end/motion-blocks/cloud/gizmo';
import type { MotionBlockPlugin } from '@/front-end/motion-blocks/core/plugin-types';
import { CloudRenderer } from '@/front-end/motion-blocks/cloud/renderer/CloudRenderer';
import CloudInspector from '@/front-end/motion-blocks/cloud/inspector/CloudInspector.vue';
import type { MotionTrack, WolkProjectFont } from '@/types/project_types';
import { resolveCloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';

function inheritProjectFont(track: MotionTrack, projectFont?: WolkProjectFont) {
    const style = track.block.style || { ...DEFAULT_CLOUD_STYLE };
    const shouldInheritProjectFont = !style.fontLocalPath && (
        !style.fontFamily ||
        style.fontFamily === projectFont?.family ||
        style.fontFamily === 'ProjectFont'
    );

    return {
        ...DEFAULT_CLOUD_STYLE,
        ...style,
        fontFallbacks: style.fontFallbacks ?? (shouldInheritProjectFont ? projectFont?.fallbacks || [] : []),
        fontName: style.fontName ?? (shouldInheritProjectFont ? projectFont?.name : undefined),
        fontLocalPath: style.fontLocalPath ?? (shouldInheritProjectFont ? projectFont?.localPath : undefined),
    };
}

export const cloudMotionBlockPlugin: MotionBlockPlugin = {
    type: 'cloud',
    meta: {
        label: 'Cloud',
        description: 'Scatters in-range lyric words at deterministic positions that accumulate over time inside the constraint region.',
        authorable: true,
        order: 2,
        requiresSourceTrack: true,
        renderSpace: '2d',
    },
    createTrack({ project, sourceTrack, startMs, endMs, color, trackId, blockId }) {
        if (!sourceTrack) throw new Error('Cloud motion block requires a source track.');
        return {
            id: trackId,
            name: `cloud - ${sourceTrack.name}`,
            color,
            enabled: true,
            muted: false,
            solo: false,
            locked: false,
            collapsed: false,
            block: {
                id: blockId,
                type: 'cloud',
                sourceTrackId: sourceTrack.id,
                startMs,
                endMs,
                style: {
                    ...DEFAULT_CLOUD_STYLE,
                    fontFamily: project.font.family || DEFAULT_CLOUD_STYLE.fontFamily,
                    fontFallbacks: [...(project.font.fallbacks || [])],
                    fontStyle: project.font.style || DEFAULT_CLOUD_STYLE.fontStyle,
                    fontWeight: project.font.weight || DEFAULT_CLOUD_STYLE.fontWeight,
                    fontName: project.font.name,
                    fontLocalPath: project.font.localPath,
                },
                transform: { ...DEFAULT_CLOUD_TRANSFORM },
                enter: createDefaultCloudEnter(),
                exit: createDefaultCloudExit(),
                overrides: [],
                params: { ...DEFAULT_CLOUD_PARAMS },
                propertyTracks: [],
            },
        };
    },
    normalizeTrack(track, { projectFont }) {
        const propertyTracks = (track.block.propertyTracks || []).filter((propertyTrack) => {
            if (!propertyTrack || propertyTrack.enabled === false) return false;
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
                type: 'cloud',
                style: inheritProjectFont(track, projectFont),
                params: resolveCloudLayoutParams(track.block.params),
                propertyTracks,
            },
        };
    },
    createRenderer() {
        return new CloudRenderer();
    },
    resolveActiveItems: resolveCloudActiveItems,
    resolveBlockItems: resolveCloudBlockItems,
    cleanOrphanedOverrides: cleanCloudOrphanedOverrides,
    collectFonts: collectCloudFonts,
    getKeyframeProperties: () => CLOUD_KEYFRAME_PROPERTIES,
    inspectorComponent: CloudInspector,
    gizmo: {
        getFallbackBounds: getCloudFallbackBounds,
        applyDelta(track, mode, dx, dy, context) {
            return applyCloudGizmoDelta(track, mode, dx, dy, context.renderWidth, context.renderHeight);
        },
        supportsSafeAreaGuide: false,
    },
};
