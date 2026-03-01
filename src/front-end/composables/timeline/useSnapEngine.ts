import { ref, computed, type Ref, type ComputedRef } from 'vue';

export interface SnapTarget {
    timeSec: number;
    label?: string;
    /** Source identifier so the dragged item can exclude its own edges */
    sourceId?: string;
}

export interface SnapLine {
    timeSec: number;
    label?: string;
}

export interface SnapResult {
    snapped: boolean;
    timeSec: number;
    snapLine: SnapLine | null;
}

export interface SnapEngineOptions {
    viewport: Ref<{ startSec: number; durationSec: number; totalSec: number; fps: number }> | ComputedRef<{ startSec: number; durationSec: number; totalSec: number; fps: number }>;
    /** Container width in pixels for threshold calculation */
    containerWidth: Ref<number>;
    /** Snap threshold in pixels (default 5) */
    thresholdPx?: number;
}

/**
 * Unified snap engine for timeline operations.
 *
 * Register snap target sources (block edges, playhead, beats, etc.) and call
 * `findSnap()` during drag to get the closest snap target within threshold.
 * Active snap lines are exposed reactively for the SnapOverlay to render.
 */
export function useSnapEngine(opts: SnapEngineOptions) {
    const thresholdPx = opts.thresholdPx ?? 5;
    const enabled = ref(true);
    const altSuppressed = ref(false);

    const isActive = computed(() => enabled.value && !altSuppressed.value);

    /** All registered snap target sources */
    const targetSources = ref<Ref<SnapTarget[]>[]>([]);

    /** Currently visible snap lines (set by findSnap, cleared by clearSnap) */
    const activeSnapLines = ref<SnapLine[]>([]);

    /** Convert pixel threshold to time threshold based on current viewport/width */
    const thresholdSec = computed(() => {
        const w = Math.max(1, opts.containerWidth.value);
        const dur = opts.viewport.value.durationSec;
        return (thresholdPx / w) * dur;
    });

    /** Register a reactive array of snap targets. Returns unregister function. */
    const registerTargets = (targets: Ref<SnapTarget[]>) => {
        targetSources.value = [...targetSources.value, targets];
        return () => {
            targetSources.value = targetSources.value.filter(s => s !== targets);
        };
    };

    /** All snap targets flattened */
    const allTargets = computed(() => {
        const result: SnapTarget[] = [];
        for (const source of targetSources.value) {
            result.push(...source.value);
        }
        return result;
    });

    /**
     * Find the closest snap target to the given time.
     * @param timeSec - The time to snap
     * @param excludeSourceId - Optional source ID to exclude (the item being dragged)
     */
    const findSnap = (timeSec: number, excludeSourceId?: string): SnapResult => {
        if (!isActive.value) {
            activeSnapLines.value = [];
            return { snapped: false, timeSec, snapLine: null };
        }

        const thresh = thresholdSec.value;
        let bestTarget: SnapTarget | null = null;
        let bestDist = Infinity;

        for (const target of allTargets.value) {
            if (excludeSourceId && target.sourceId === excludeSourceId) continue;
            const dist = Math.abs(target.timeSec - timeSec);
            if (dist < thresh && dist < bestDist) {
                bestDist = dist;
                bestTarget = target;
            }
        }

        if (bestTarget) {
            const line: SnapLine = { timeSec: bestTarget.timeSec, label: bestTarget.label };
            activeSnapLines.value = [line];
            return { snapped: true, timeSec: bestTarget.timeSec, snapLine: line };
        }

        activeSnapLines.value = [];
        return { snapped: false, timeSec, snapLine: null };
    };

    /** Clear active snap lines (call on drag end) */
    const clearSnap = () => {
        activeSnapLines.value = [];
    };

    /** Call on keydown/keyup to track Alt suppression */
    const setAltSuppressed = (suppressed: boolean) => {
        altSuppressed.value = suppressed;
        if (suppressed) activeSnapLines.value = [];
    };

    return {
        enabled,
        isActive,
        activeSnapLines,
        registerTargets,
        findSnap,
        clearSnap,
        setAltSuppressed,
    };
}
