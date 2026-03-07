import {
    DEFAULT_MOTION_ENTER_EXIT,
    type LyricTrack,
    type MotionBlock,
    type MotionEnterExit,
    type TimelineItem,
    type WolkProject,
} from '@/types/project_types';
import type { ResolvedItem } from '@/front-end/motion/types';
import { computeEnterExitProgress, msToFrame } from '@/front-end/utils/motion/enterExitAnimation';
import { extractPlainTextFromTipTap } from '@/front-end/utils/motion/parseTipTapToSpans';

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
            // Empty rich-text payload means "use source text".
            if (!plain || plain.trim().length === 0) {
                return { text: sourceText };
            }
            return { text: plain, richText: parsed };
        }
    } catch {}

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
        fade: {
            ...(base.fade ?? {}),
            ...(override.fade ?? {}),
        },
        move: {
            ...(base.move ?? {}),
            ...(override.move ?? {}),
        },
        scale: {
            ...(base.scale ?? {}),
            ...(override.scale ?? {}),
        },
    };
};

export function resolveActiveItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] {
    if (!sourceTrack) return [];

    const enter = block.enter ?? DEFAULT_MOTION_ENTER_EXIT;
    const exit = block.exit ?? DEFAULT_MOTION_ENTER_EXIT;
    const overrideMap = new Map(block.overrides.map((override) => [override.sourceItemId, override]));

    return sourceTrack.items
        .filter((item) => isItemWithinBlockRange(item, block))
        .filter((item) => isItemActiveAtFrame(item, currentFrame, fps))
        .map((item) => {
            const override = overrideMap.get(item.id);
            if (override?.hidden) return null;
            const { text: resolvedText, richText } = resolveOverrideText(item.text, override?.textOverride);

            const resolvedEnter = mergeEnterExit(enter, override?.enterOverride);
            const resolvedExit = mergeEnterExit(exit, override?.exitOverride);
            const { enterProgress, exitProgress } = computeEnterExitProgress(
                item,
                currentFrame,
                fps,
                resolvedEnter,
                resolvedExit,
            );
            return {
                id: item.id,
                text: resolvedText,
                richText,
                startMs: item.startMs,
                endMs: item.endMs,
                enterProgress,
                exitProgress,
                isActive: true,
                style: {
                    ...block.style,
                    ...(override?.styleOverride ?? {}),
                },
                transform: {
                    ...block.transform,
                    ...(override?.transformOverride ?? {}),
                },
                enter: resolvedEnter,
                exit: resolvedExit,
                wordStyleMap: override?.wordStyleMap,
                forceStyleColor: !!override?.styleOverride?.color,
            } as ResolvedItem;
        })
        .filter((item): item is ResolvedItem => item !== null);
}

export function resolveBlockItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] {
    if (!sourceTrack) return [];

    const enter = block.enter ?? DEFAULT_MOTION_ENTER_EXIT;
    const exit = block.exit ?? DEFAULT_MOTION_ENTER_EXIT;
    const overrideMap = new Map(block.overrides.map((override) => [override.sourceItemId, override]));

    return sourceTrack.items
        .filter((item) => isItemWithinBlockRange(item, block))
        .map((item) => {
            const override = overrideMap.get(item.id);
            if (override?.hidden) return null;
            const { text: resolvedText, richText } = resolveOverrideText(item.text, override?.textOverride);

            const resolvedEnter = mergeEnterExit(enter, override?.enterOverride);
            const resolvedExit = mergeEnterExit(exit, override?.exitOverride);
            const { enterProgress, exitProgress } = computeEnterExitProgress(
                item,
                currentFrame,
                fps,
                resolvedEnter,
                resolvedExit,
            );
            return {
                id: item.id,
                text: resolvedText,
                richText,
                startMs: item.startMs,
                endMs: item.endMs,
                enterProgress,
                exitProgress,
                isActive: isItemActiveAtFrame(item, currentFrame, fps),
                style: {
                    ...block.style,
                    ...(override?.styleOverride ?? {}),
                },
                transform: {
                    ...block.transform,
                    ...(override?.transformOverride ?? {}),
                },
                enter: resolvedEnter,
                exit: resolvedExit,
                wordStyleMap: override?.wordStyleMap,
                forceStyleColor: !!override?.styleOverride?.color,
            } as ResolvedItem;
        })
        .filter((item): item is ResolvedItem => item !== null);
}

export function cleanOrphanedOverrides(project: WolkProject): { removedCount: number } {
    let removedCount = 0;
    const trackById = new Map(project.lyricTracks.map((track) => [track.id, track]));

    for (const motionTrack of project.motionTracks) {
        const sourceTrack = trackById.get(motionTrack.block.sourceTrackId);
        if (!sourceTrack) {
            if (motionTrack.block.overrides.length > 0) {
                removedCount += motionTrack.block.overrides.length;
                motionTrack.block.overrides = [];
            }
            continue;
        }

        const sourceItemIds = new Set(sourceTrack.items.map((item) => item.id));
        const before = motionTrack.block.overrides.length;
        motionTrack.block.overrides = motionTrack.block.overrides.filter((override) => sourceItemIds.has(override.sourceItemId));
        removedCount += before - motionTrack.block.overrides.length;
    }

    return { removedCount };
}
