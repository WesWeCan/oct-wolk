import type { ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { getPrimitive3DAnchorCapacity } from '@/front-end/motion-blocks/primitive3d/anchor-points';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { computeEnterExitProgress, msToFrame } from '@/front-end/utils/motion/enterExitAnimation';
import { computeTextRevealProgress } from '@/front-end/utils/motion/textReveal';
import type { ItemOverride, LyricTrack, MotionBlock, MotionEnterExit, TimelineItem, WolkProject } from '@/types/project_types';

const isItemWithinBlockRange = (item: TimelineItem, block: MotionBlock): boolean => {
    return item.endMs > block.startMs && item.startMs < block.endMs;
};

const stripPunctuation = (value: string): string => {
    return value.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim();
};

const resolveVisibleText = (text: string, punctuationMode: ReturnType<typeof resolvePrimitive3DParams>['words']['punctuationMode']): string => {
    if (punctuationMode === 'strip') return stripPunctuation(text);
    return text.trim();
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

const buildEffectiveTimingItem = (
    item: TimelineItem,
    block: MotionBlock,
    slotReuseStartMs: number,
    exitMode: ReturnType<typeof resolvePrimitive3DParams>['lifecycle']['exitMode'],
    exitDelayMs: number,
): TimelineItem => {
    if (exitMode === 'stay') {
        return {
            ...item,
            endMs: Math.max(item.endMs, slotReuseStartMs),
        };
    }

    return {
        ...item,
        endMs: Math.max(item.endMs, Math.min(slotReuseStartMs, item.endMs + exitDelayMs, block.endMs)),
    };
};

const buildResolvedWordItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
    activeOnly: boolean,
): ResolvedItem[] => {
    const params = resolvePrimitive3DParams(block.params);
    const slotCount = getPrimitive3DAnchorCapacity(params);
    if (!params.words.enabled || !sourceTrack || slotCount <= 0) return [];

    const overrideMap = new Map(block.overrides.map((override) => [override.sourceItemId, override]));
    const sourceItems = sourceTrack.items
        .filter((item) => isItemWithinBlockRange(item, block))
        .map((item) => {
            const override = overrideMap.get(item.id);
            if (override?.hidden) return null;
            const textOverride = override?.textOverride?.trim();
            const candidateText = textOverride && textOverride.length > 0 ? textOverride : item.text;
            const visibleText = resolveVisibleText(candidateText, params.words.punctuationMode);
            if (!visibleText) return null;
            return { item, override, visibleText };
        })
        .filter((entry): entry is { item: TimelineItem; override?: ItemOverride; visibleText: string } => entry !== null);

    return sourceItems
        .map(({ item, override, visibleText }, sourceIndex) => {
            const windowEndSource = sourceItems[sourceIndex + slotCount];
            const slotReuseStartMs = Math.min(block.endMs, windowEndSource?.item.startMs ?? block.endMs);
            const effectiveItem = buildEffectiveTimingItem(
                item,
                block,
                slotReuseStartMs,
                params.lifecycle.exitMode,
                params.lifecycle.exitDelayMs,
            );
            const visibleItem = {
                ...effectiveItem,
                text: visibleText,
            };
            const startFrame = msToFrame(effectiveItem.startMs, fps);
            const endFrame = Math.max(startFrame + 1, msToFrame(effectiveItem.endMs, fps));
            const isActive = currentFrame >= startFrame && currentFrame < endFrame;
            if (activeOnly && !isActive) return null;

            const wordStyleOverride = override?.wordStyleMap?.[0] ?? {};
            const resolvedEnter = mergeEnterExit(block.enter, override?.enterOverride);
            const resolvedExit = mergeEnterExit(block.exit, override?.exitOverride);
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
                params.textReveal,
                resolvedEnter,
                resolvedExit,
                {
                    durationItem: item,
                    enterStartMs: item.startMs,
                    exitEndMs: effectiveItem.endMs,
                },
            );

            return {
                id: `${block.id}:primitive3d:word:${item.id}`,
                text: visibleText,
                richText: {
                    primitive3dWord: {
                        slotIndex: sourceIndex % slotCount,
                        slotCount,
                        sourceIndex,
                        sourceItemId: item.id,
                    },
                },
                startMs: visibleItem.startMs,
                endMs: visibleItem.endMs,
                enterProgress,
                exitProgress,
                textRevealEnterProgress: textRevealProgress.enterProgress,
                textRevealExitProgress: textRevealProgress.exitProgress,
                isActive,
                style: {
                    ...block.style,
                    ...(override?.styleOverride ?? {}),
                    ...wordStyleOverride,
                },
                transform: {
                    ...block.transform,
                    ...(override?.transformOverride ?? {}),
                },
                enter: resolvedEnter,
                exit: resolvedExit,
                wordStyleMap: override?.wordStyleMap,
                forceStyleColor: !!override?.styleOverride?.color || !!wordStyleOverride.color,
            } as ResolvedItem;
        })
        .filter((item): item is ResolvedItem => item !== null);
};

export const resolvePrimitive3DActiveItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] => {
    return buildResolvedWordItems(block, sourceTrack, currentFrame, fps, true);
};

export const resolvePrimitive3DBlockItems = (
    block: MotionBlock,
    sourceTrack: LyricTrack | null | undefined,
    currentFrame: number,
    fps: number,
): ResolvedItem[] => {
    return buildResolvedWordItems(block, sourceTrack, currentFrame, fps, false);
};

export const cleanPrimitive3DOrphanedOverrides = (project: WolkProject) => {
    let removedCount = 0;
    const trackById = new Map(project.lyricTracks.map((track) => [track.id, track]));

    for (const motionTrack of project.motionTracks) {
        if (motionTrack.block.type !== 'primitive3d') continue;
        const sourceTrack = trackById.get(motionTrack.block.sourceTrackId);
        if (!sourceTrack) continue;
        const validItemIds = new Set(sourceTrack.items.map((item) => item.id));
        const nextOverrides = (motionTrack.block.overrides || []).filter((override) => validItemIds.has(override.sourceItemId));
        removedCount += (motionTrack.block.overrides || []).length - nextOverrides.length;
        motionTrack.block.overrides = nextOverrides;
    }

    return { removedCount };
};
