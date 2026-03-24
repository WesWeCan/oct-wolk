import {
    cleanSubtitleOrphanedOverrides,
    resolveSubtitleActiveItems,
    resolveSubtitleBlockItems,
} from '@/front-end/motion-blocks/subtitle/item-resolvers';
import type { LyricTrack, MotionBlock } from '@/types/project_types';
import { isCloudSupportedSourceTrack } from '@/front-end/motion-blocks/cloud/source-tracks';

const resolveIfSupported = (
    resolver: typeof resolveSubtitleActiveItems,
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
) => {
    if (!isCloudSupportedSourceTrack(sourceTrack)) return [];
    return resolver(block, sourceTrack, currentFrame, fps);
};

export const resolveCloudActiveItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
) => resolveIfSupported(resolveSubtitleActiveItems, block, sourceTrack, currentFrame, fps);

export const resolveCloudBlockItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
) => resolveIfSupported(resolveSubtitleBlockItems, block, sourceTrack, currentFrame, fps);

export const cleanCloudOrphanedOverrides = cleanSubtitleOrphanedOverrides;
