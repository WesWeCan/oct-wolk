import type {
    ItemOverride,
    LyricTrack,
    MotionBlock,
    MotionEnterExit,
    TimelineItem,
    WolkProject,
} from '@/types/project_types';
import type { ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { computeEnterExitProgress, msToFrame } from '@/front-end/utils/motion/enterExitAnimation';
import { extractPlainTextFromTipTap } from '@/front-end/utils/motion/parseTipTapToSpans';
import { computeTextRevealProgress } from '@/front-end/utils/motion/textReveal';
import { DEFAULT_CLOUD_ENTER_EXIT } from '@/front-end/motion-blocks/cloud/defaults';
import { isCloudSupportedSourceTrack } from '@/front-end/motion-blocks/cloud/source-tracks';
import { resolveCloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';

const isItemWithinBlockRange = (item: TimelineItem, block: MotionBlock): boolean => {
    return item.endMs > block.startMs && item.startMs < block.endMs;
};

const isItemActiveAtFrame = (item: TimelineItem, currentFrame: number, fps: number): boolean => {
    const startFrame = msToFrame(item.startMs, fps);
    const endFrame = msToFrame(item.endMs, fps);
    return currentFrame >= startFrame && currentFrame <= endFrame;
};

const resolveOverrideText = (
    sourceText: string,
    textOverride?: string,
): { text: string; richText?: any } => {
    if (!textOverride || textOverride.trim().length === 0) {
        return { text: sourceText };
    }

    try {
        const parsed = JSON.parse(textOverride);
        if (parsed && typeof parsed === 'object') {
            const plain = extractPlainTextFromTipTap(parsed);
            if (!plain || plain.trim().length === 0) {
                return { text: sourceText };
            }
            return { text: plain, richText: parsed };
        }
    } catch { /* not JSON, treat as plain text */ }

    if (textOverride.trim().length === 0) {
        return { text: sourceText };
    }
    return { text: textOverride };
};

const mergeEnterExit = (
    base: MotionEnterExit,
    override?: Partial<MotionEnterExit>,
): MotionEnterExit => {
    if (!override) return base;
    return {
        ...base,
        ...override,
        fade: { ...(base.fade ?? {}), ...(override.fade ?? {}) },
        move: { ...(base.move ?? {}), ...(override.move ?? {}) },
        scale: { ...(base.scale ?? {}), ...(override.scale ?? {}) },
    };
};

function resolveCloudItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
    activeOnly: boolean,
): ResolvedItem[] {
    if (!sourceTrack || !isCloudSupportedSourceTrack(sourceTrack)) return [];

    const enter = block.enter ?? DEFAULT_CLOUD_ENTER_EXIT;
    const exit = block.exit ?? DEFAULT_CLOUD_ENTER_EXIT;
    const overrideMap = new Map(block.overrides.map((o) => [o.sourceItemId, o]));

    const params = resolveCloudLayoutParams(block.params);

    return sourceTrack.items
        .filter((item) => isItemWithinBlockRange(item, block))
        .filter((item) => {
            if (!activeOnly) return true;
            if (params.exitMode === 'stay') {
                return currentFrame >= msToFrame(item.startMs, fps);
            }
            const effectiveEndMs = item.endMs + params.exitDelayMs;
            const effectiveEndFrame = msToFrame(effectiveEndMs, fps);
            return currentFrame >= msToFrame(item.startMs, fps) && currentFrame <= effectiveEndFrame;
        })
        .map((item) => {
            const override = overrideMap.get(item.id);
            if (override?.hidden) return null;
            const { text: resolvedText, richText } = resolveOverrideText(item.text, override?.textOverride);
            const resolvedEnter = mergeEnterExit(enter, override?.enterOverride);
            const resolvedExit = mergeEnterExit(exit, override?.exitOverride);

            const effectiveItem = buildEffectiveTimingItem(item, block, params.exitMode, params.exitDelayMs);

            const { enterProgress, exitProgress } = computeEnterExitProgress(
                effectiveItem,
                currentFrame,
                fps,
                resolvedEnter,
                resolvedExit,
            );
            const textRevealProgress = computeTextRevealProgress(
                item,
                currentFrame,
                fps,
                params,
                resolvedEnter,
                resolvedExit,
                {
                    durationItem: item,
                    enterStartMs: item.startMs,
                    exitEndMs: effectiveItem.endMs,
                },
            );

            return {
                id: item.id,
                text: resolvedText,
                richText,
                startMs: item.startMs,
                endMs: item.endMs,
                enterProgress,
                exitProgress,
                textRevealEnterProgress: textRevealProgress.enterProgress,
                textRevealExitProgress: textRevealProgress.exitProgress,
                isActive: isItemActiveAtFrame(item, currentFrame, fps),
                style: { ...block.style, ...(override?.styleOverride ?? {}) },
                transform: { ...block.transform, ...(override?.transformOverride ?? {}) },
                enter: resolvedEnter,
                exit: resolvedExit,
                wordStyleMap: override?.wordStyleMap,
                forceStyleColor: !!override?.styleOverride?.color,
            } as ResolvedItem;
        })
        .filter((item): item is ResolvedItem => item !== null);
}

function buildEffectiveTimingItem(
    item: TimelineItem,
    block: MotionBlock,
    exitMode: string,
    exitDelayMs: number,
): TimelineItem {
    if (exitMode === 'stay') {
        return { ...item, endMs: block.endMs };
    }
    return { ...item, endMs: Math.min(item.endMs + exitDelayMs, block.endMs) };
}

export const resolveCloudActiveItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] => resolveCloudItems(block, sourceTrack, currentFrame, fps, true);

export const resolveCloudBlockItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] => resolveCloudItems(block, sourceTrack, currentFrame, fps, false);

export function cleanCloudOrphanedOverrides(project: WolkProject): { removedCount: number } {
    let removedCount = 0;
    const trackById = new Map(project.lyricTracks.map((track) => [track.id, track]));

    for (const motionTrack of project.motionTracks) {
        if (motionTrack.block.type !== 'cloud') continue;
        const sourceTrack = trackById.get(motionTrack.block.sourceTrackId);
        if (!sourceTrack) {
            if (motionTrack.block.overrides.length > 0) {
                removedCount += motionTrack.block.overrides.length;
                motionTrack.block.overrides = [];
            }
            continue;
        }

        const sourceItemIds = new Set(sourceTrack.items.map((i) => i.id));
        const before = motionTrack.block.overrides.length;
        motionTrack.block.overrides = motionTrack.block.overrides.filter((o) => sourceItemIds.has(o.sourceItemId));
        removedCount += before - motionTrack.block.overrides.length;
    }

    return { removedCount };
}
