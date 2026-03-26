import type { ResolvedItem } from '@/front-end/motion-blocks/core/types';
import type { LyricTrack, MotionBlock, WolkProject } from '@/types/project_types';

const resolvePrimitive3DItems = (
    block: MotionBlock,
    currentFrame: number,
    fps: number,
    activeOnly: boolean,
): ResolvedItem[] => {
    const startFrame = Math.round((block.startMs / 1000) * Math.max(1, fps));
    const endFrame = Math.round((block.endMs / 1000) * Math.max(1, fps));
    const isActive = currentFrame >= startFrame && currentFrame <= endFrame;
    if (activeOnly && !isActive) return [];

    return [{
        id: `${block.id}:primitive3d`,
        text: '',
        startMs: block.startMs,
        endMs: block.endMs,
        enterProgress: isActive ? 1 : 0,
        exitProgress: 0,
        isActive,
        style: block.style,
        transform: block.transform,
        enter: block.enter,
        exit: block.exit,
    }];
};

export const resolvePrimitive3DActiveItems = (
    block: MotionBlock,
    _sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] => {
    return resolvePrimitive3DItems(block, currentFrame, fps, true);
};

export const resolvePrimitive3DBlockItems = (
    block: MotionBlock,
    _sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] => {
    return resolvePrimitive3DItems(block, currentFrame, fps, false);
};

export const cleanPrimitive3DOrphanedOverrides = (_project: WolkProject) => ({ removedCount: 0 });
