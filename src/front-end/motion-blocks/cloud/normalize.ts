import { DEFAULT_CLOUD_STYLE } from '@/front-end/motion-blocks/cloud/defaults';
import { resolveCloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';
import { normalizeSubtitleEnterExit } from '@/front-end/motion-blocks/subtitle/defaults';
import type { NormalizeMotionTrackArgs } from '@/front-end/motion-blocks/core/plugin-types';
import type { MotionTrack, WolkProjectFont } from '@/types/project_types';

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

export function normalizeCloudTrack(track: MotionTrack, { projectFont }: NormalizeMotionTrackArgs): MotionTrack {
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
            type: 'cloud',
            style: inheritProjectFont(track, projectFont),
            enter,
            exit,
            params: resolveCloudLayoutParams(track.block.params, enter, exit),
            propertyTracks,
        },
    };
}
