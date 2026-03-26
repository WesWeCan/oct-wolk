import type { DeterministicRandomness } from '@/front-end/motion/deterministicRandomness';
import type { CloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';

export interface CloudMeasuredItem {
    id: string;
    sortMs: number;
    width: number;
    height: number;
}

export interface CloudPlacedItem extends CloudMeasuredItem {
    x: number;
    y: number;
    itemScale: number;
}

export interface CloudLayoutBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}

export interface CloudLayoutResult {
    items: CloudPlacedItem[];
    bounds: CloudLayoutBounds;
}

const EMPTY_BOUNDS: CloudLayoutBounds = {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0,
};

const computeBounds = (items: CloudPlacedItem[]): CloudLayoutBounds => {
    if (items.length === 0) return EMPTY_BOUNDS;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const item of items) {
        const right = item.x + item.width * item.itemScale;
        const bottom = item.y + item.height * item.itemScale;
        if (item.x < minX) minX = item.x;
        if (item.y < minY) minY = item.y;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

const TARGET_COVERAGE = 0.65;
const MIN_FIT_SCALE = 0.3;
const MAX_FIT_SCALE = 3;

/**
 * Greedy 2D scatter placement with occupancy-based auto-fit.
 *
 * A global fit scale is derived from the ratio of total item area to
 * region area so the cloud naturally fills the available space.
 * Fewer words or a larger region → bigger words; more words or a
 * smaller region → smaller words.
 *
 * Words are placed in temporal order. Each word gets a deterministic
 * preferred position seeded from its id, then spirals outward until
 * a non-overlapping slot is found. This keeps positions stable when
 * the item set stays the same — layout is O(n²) worst-case but
 * typically fast for < 300 words.
 */
export const layoutCloudItems = (
    items: CloudMeasuredItem[],
    randomness: DeterministicRandomness | null | undefined,
    regionWidth: number,
    regionHeight: number,
    params: CloudLayoutParams,
): CloudLayoutResult => {
    if (items.length === 0) {
        return { items: [], bounds: EMPTY_BOUNDS };
    }

    const halfW = regionWidth / 2;
    const halfH = regionHeight / 2;
    const gap = params.gap;

    const sorted = [...items].sort((a, b) =>
        a.sortMs - b.sortMs || a.id.localeCompare(b.id),
    );

    // Pre-pass: compute per-item variation and total base area for the fit scale.
    // createRng with the same key always returns the same sequence, so consuming
    // one value here and re-creating the RNG in the placement pass is safe.
    const variationFactors: number[] = [];
    let totalBaseArea = 0;
    for (const item of sorted) {
        const rng = randomness?.createRng(`cloud:${item.id}`);
        const r = () => (rng ? rng() : 0.5);
        const variation = Math.max(0.3, 1 + (r() - 0.5) * 2 * params.sizeVariation);
        variationFactors.push(variation);
        const w = item.width * variation;
        const h = item.height * variation;
        totalBaseArea += (w + gap) * (h + gap);
    }

    const regionArea = regionWidth * regionHeight;
    const rawFitScale = totalBaseArea > 0
        ? Math.sqrt((regionArea * TARGET_COVERAGE) / totalBaseArea)
        : 1;
    const fitScale = Math.max(MIN_FIT_SCALE, Math.min(MAX_FIT_SCALE, rawFitScale));

    const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const result: CloudPlacedItem[] = [];

    const overlapsAny = (x: number, y: number, w: number, h: number): boolean => {
        for (const box of placedBoxes) {
            if (
                x < box.x + box.w + gap &&
                x + w + gap > box.x &&
                y < box.y + box.h + gap &&
                y + h + gap > box.y
            ) {
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const rng = randomness?.createRng(`cloud:${item.id}`);
        const r = () => (rng ? rng() : 0.5);
        r(); // consume the variation roll (mirrors pre-pass)

        const itemScale = variationFactors[i] * fitScale;
        const w = item.width * itemScale;
        const h = item.height * itemScale;

        if (w > regionWidth || h > regionHeight) continue;

        const rangeX = Math.max(0, halfW - w / 2);
        const rangeY = Math.max(0, halfH - h / 2);
        const spreadX = rangeX * params.scatter;
        const spreadY = rangeY * params.scatter;

        const prefCenterX = (r() - 0.5) * 2 * spreadX;
        const prefCenterY = (r() - 0.5) * 2 * spreadY;

        const clampTL = (cx: number, cy: number) => ({
            x: Math.max(-halfW, Math.min(halfW - w, cx - w / 2)),
            y: Math.max(-halfH, Math.min(halfH - h, cy - h / 2)),
        });

        const tryPlace = (cx: number, cy: number): { x: number; y: number } | null => {
            const pos = clampTL(cx, cy);
            if (!overlapsAny(pos.x, pos.y, w, h)) return pos;
            return null;
        };

        let pos = tryPlace(prefCenterX, prefCenterY);

        if (!pos) {
            const stepSize = Math.max(gap + 1, Math.min(w, h) * 0.4);
            const maxRadius = Math.max(regionWidth, regionHeight);
            const startAngle = r() * Math.PI * 2;

            for (let radius = stepSize; radius < maxRadius && !pos; radius += stepSize) {
                const numSteps = Math.max(8, Math.ceil((2 * Math.PI * radius) / stepSize));
                for (let j = 0; j < numSteps && !pos; j++) {
                    const angle = startAngle + (j / numSteps) * Math.PI * 2;
                    pos = tryPlace(
                        prefCenterX + radius * Math.cos(angle),
                        prefCenterY + radius * Math.sin(angle),
                    );
                }
            }
        }

        if (pos) {
            result.push({ ...item, x: pos.x, y: pos.y, itemScale });
            placedBoxes.push({ x: pos.x, y: pos.y, w, h });
        }
    }

    return { items: result, bounds: computeBounds(result) };
};
