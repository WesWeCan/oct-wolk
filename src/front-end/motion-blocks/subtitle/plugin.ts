import {
    createDefaultSubtitleEnter,
    createDefaultSubtitleExit,
    DEFAULT_SUBTITLE_STYLE,
    DEFAULT_SUBTITLE_TRANSFORM,
    normalizeSubtitleEnterExit,
} from '@/front-end/motion-blocks/subtitle/defaults';
import { collectSubtitleFonts } from '@/front-end/motion-blocks/subtitle/fonts';
import {
    cleanSubtitleOrphanedOverrides,
    resolveSubtitleActiveItems,
    resolveSubtitleBlockItems,
} from '@/front-end/motion-blocks/subtitle/item-resolvers';
import { SUBTITLE_KEYFRAME_PROPERTIES } from '@/front-end/motion-blocks/subtitle/keyframes';
import { applySubtitleGizmoDelta, getSubtitleFallbackBounds } from '@/front-end/motion-blocks/subtitle/gizmo';
import type { MotionBlockPlugin } from '@/front-end/motion-blocks/core/plugin-types';
import { SubtitleRenderer } from '@/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer';
import SubtitleInspector from '@/front-end/motion-blocks/subtitle/inspector/SubtitleInspector.vue';
import type { MotionTrack, WolkProjectFont } from '@/types/project_types';
import { subtitleMotionPresetAdapter } from '@/front-end/motion-blocks/subtitle/presets';
import { DEFAULT_TEXT_REVEAL_PARAMS, resolveTextRevealParams } from '@/front-end/utils/motion/textReveal';

function inheritProjectFont(track: MotionTrack, projectFont?: WolkProjectFont) {
    const style = track.block.style || { ...DEFAULT_SUBTITLE_STYLE };
    const shouldInheritProjectFont = !style.fontLocalPath && (
        !style.fontFamily ||
        style.fontFamily === projectFont?.family ||
        style.fontFamily === 'ProjectFont'
    );

    return {
        ...DEFAULT_SUBTITLE_STYLE,
        ...style,
        fontFallbacks: style.fontFallbacks ?? (shouldInheritProjectFont ? projectFont?.fallbacks || [] : []),
        fontName: style.fontName ?? (shouldInheritProjectFont ? projectFont?.name : undefined),
        fontLocalPath: style.fontLocalPath ?? (shouldInheritProjectFont ? projectFont?.localPath : undefined),
    };
}

export const subtitleMotionBlockPlugin: MotionBlockPlugin = {
    type: 'subtitle',
    meta: {
        label: 'Subtitle',
        description: 'Renders lyric-backed subtitle text with styling, item overrides, safe-area layout, and 2D transform controls.',
        authorable: true,
        order: 1,
    },
    createTrack({ project, sourceTrack, startMs, endMs, color, trackId, blockId }) {
        return {
            id: trackId,
            name: `subtitle - ${sourceTrack.name}`,
            color,
            enabled: true,
            muted: false,
            solo: false,
            locked: false,
            collapsed: false,
            block: {
                id: blockId,
                type: 'subtitle',
                sourceTrackId: sourceTrack.id,
                startMs,
                endMs,
                style: {
                    ...DEFAULT_SUBTITLE_STYLE,
                    fontFamily: project.font.family || DEFAULT_SUBTITLE_STYLE.fontFamily,
                    fontFallbacks: [...(project.font.fallbacks || [])],
                    fontStyle: project.font.style || DEFAULT_SUBTITLE_STYLE.fontStyle,
                    fontWeight: project.font.weight || DEFAULT_SUBTITLE_STYLE.fontWeight,
                    fontName: project.font.name,
                    fontLocalPath: project.font.localPath,
                },
                transform: { ...DEFAULT_SUBTITLE_TRANSFORM },
                enter: createDefaultSubtitleEnter(),
                exit: createDefaultSubtitleExit(),
                overrides: [],
                params: { ...DEFAULT_TEXT_REVEAL_PARAMS },
                propertyTracks: [],
            },
        };
    },
    normalizeTrack(track, { projectFont }) {
        const propertyTracks = (track.block.propertyTracks || []).filter((propertyTrack) => {
            if (!propertyTrack || propertyTrack.enabled === false) return false;
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
                type: 'subtitle',
                style: inheritProjectFont(track, projectFont),
                enter,
                exit,
                params: {
                    ...(track.block.params || {}),
                    ...resolveTextRevealParams(track.block.params, enter, exit),
                },
                propertyTracks,
            },
        };
    },
    createRenderer() {
        return new SubtitleRenderer();
    },
    resolveActiveItems: resolveSubtitleActiveItems,
    resolveBlockItems: resolveSubtitleBlockItems,
    cleanOrphanedOverrides: cleanSubtitleOrphanedOverrides,
    collectFonts: collectSubtitleFonts,
    getKeyframeProperties: () => SUBTITLE_KEYFRAME_PROPERTIES,
    presets: {
        version: subtitleMotionPresetAdapter.version,
        extractPayload(track, args) {
            const normalized = subtitleMotionBlockPlugin.normalizeTrack(track, args);
            return subtitleMotionPresetAdapter.extractPayload(normalized, args);
        },
        applyPreset(track, document, args) {
            const updated = subtitleMotionPresetAdapter.applyPreset(track, document, args);
            return subtitleMotionBlockPlugin.normalizeTrack(updated, args);
        },
    },
    inspectorComponent: SubtitleInspector,
    gizmo: {
        getFallbackBounds: getSubtitleFallbackBounds,
        applyDelta(track, mode, dx, dy, context) {
            return applySubtitleGizmoDelta(track, mode, dx, dy, context.renderWidth, context.renderHeight);
        },
        supportsSafeAreaGuide: true,
    },
};
