import { DEFAULT_PRIMITIVE3D_STYLE, DEFAULT_PRIMITIVE3D_TRANSFORM } from '@/front-end/motion-blocks/primitive3d/defaults';
import { PRIMITIVE3D_KEYFRAME_PROPERTIES } from '@/front-end/motion-blocks/primitive3d/keyframes';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { normalizeSubtitleEnterExit } from '@/front-end/motion-blocks/subtitle/defaults';
import type { NormalizeMotionTrackArgs } from '@/front-end/motion-blocks/core/plugin-types';
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

export function normalizePrimitive3DTrack(track: MotionTrack, { projectFont }: NormalizeMotionTrackArgs): MotionTrack {
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
            transform: { ...DEFAULT_PRIMITIVE3D_TRANSFORM },
            params: collapseLegacyTransformIntoParams(track, enter, exit) as any,
            propertyTracks,
        },
    };
}
