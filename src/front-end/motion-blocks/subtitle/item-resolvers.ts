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
import { DEFAULT_SUBTITLE_ENTER_EXIT } from '@/front-end/motion-blocks/subtitle/defaults';

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

function resolveItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
    activeOnly: boolean,
): ResolvedItem[] {
    if (!sourceTrack) return [];

    const enter = block.enter ?? DEFAULT_SUBTITLE_ENTER_EXIT;
    const exit = block.exit ?? DEFAULT_SUBTITLE_ENTER_EXIT;
    const overrideMap = new Map(block.overrides.map((override) => [override.sourceItemId, override]));

    return sourceTrack.items
        .filter((item) => isItemWithinBlockRange(item, block))
        .filter((item) => !activeOnly || isItemActiveAtFrame(item, currentFrame, fps))
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
            const textRevealProgress = computeTextRevealProgress(
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
                textRevealEnterProgress: textRevealProgress.enterProgress,
                textRevealExitProgress: textRevealProgress.exitProgress,
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

export function resolveSubtitleActiveItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] {
    return resolveItems(block, sourceTrack, currentFrame, fps, true);
}

export function resolveSubtitleBlockItems(
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] {
    return resolveItems(block, sourceTrack, currentFrame, fps, false);
}

export function cleanSubtitleOrphanedOverrides(project: WolkProject): { removedCount: number } {
    let removedCount = 0;
    const trackById = new Map(project.lyricTracks.map((track) => [track.id, track]));

    for (const motionTrack of project.motionTracks) {
        if (motionTrack.block.type !== 'subtitle') continue;
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
        motionTrack.block.overrides = motionTrack.block.overrides.filter((override: ItemOverride) => sourceItemIds.has(override.sourceItemId));
        removedCount += before - motionTrack.block.overrides.length;
    }

    return { removedCount };
}
