import type { LyricTrack, MotionBlock, WolkProject } from '@/types/project_types';
import type { ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { ensureMotionBlockPluginsRegistered } from '@/front-end/motion-blocks';
import { getFallbackMotionBlockPlugin, getMotionBlockPlugin } from '@/front-end/motion-blocks/core/registry';

function resolvePlugin(type: string) {
    ensureMotionBlockPluginsRegistered();
    return getMotionBlockPlugin(type) ?? getFallbackMotionBlockPlugin();
}

export function resolveActiveItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] {
    return resolvePlugin(block.type).resolveActiveItems(block, sourceTrack, currentFrame, fps);
}

export function resolveBlockItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] {
    return resolvePlugin(block.type).resolveBlockItems(block, sourceTrack, currentFrame, fps);
}

export function cleanOrphanedOverrides(project: WolkProject): { removedCount: number } {
    ensureMotionBlockPluginsRegistered();
    let removedCount = 0;
    const seen = new Set<string>();
    for (const track of project.motionTracks) {
        if (seen.has(track.block.type)) continue;
        seen.add(track.block.type);
        const plugin = getMotionBlockPlugin(track.block.type);
        if (!plugin?.cleanOrphanedOverrides) continue;
        removedCount += plugin.cleanOrphanedOverrides(project).removedCount;
    }
    return { removedCount };
}
