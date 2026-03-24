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
    contentScale: number;
    coverage: number;
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
    const minX = Math.min(...items.map((item) => item.x));
    const minY = Math.min(...items.map((item) => item.y));
    const maxX = Math.max(...items.map((item) => item.x + item.width));
    const maxY = Math.max(...items.map((item) => item.y + item.height));
    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
};

export const layoutCloudItems = (
    items: CloudMeasuredItem[],
    randomness: DeterministicRandomness | null | undefined,
    regionWidth: number,
    regionHeight: number,
    params: CloudLayoutParams,
): CloudLayoutResult => {
    if (items.length === 0) {
        return {
            items: [],
            bounds: EMPTY_BOUNDS,
            contentScale: 1,
            coverage: 0,
        };
    }

    const regionArea = Math.max(1, regionWidth * regionHeight);
    const sorted = [...items].sort((a, b) => (
        b.height - a.height
        || b.width - a.width
        || a.sortMs - b.sortMs
        || a.id.localeCompare(b.id)
    ));

    interface PackedRow {
        items: CloudMeasuredItem[];
        width: number;
        height: number;
    }

    interface PackedLayout {
        items: CloudPlacedItem[];
        bounds: CloudLayoutBounds;
        contentScale: number;
        coverage: number;
    }

    const packAtScale = (contentScale: number): PackedLayout | null => {
        const gap = params.boxGap;
        const rowGap = params.rowGap;
        const scaled = sorted.map((item) => ({
            ...item,
            width: item.width * contentScale,
            height: item.height * contentScale,
        }));

        const rows: PackedRow[] = [];
        let currentRow: PackedRow = { items: [], width: 0, height: 0 };

        const flushRow = () => {
            if (currentRow.items.length === 0) return;
            rows.push(currentRow);
            currentRow = { items: [], width: 0, height: 0 };
        };

        for (const item of scaled) {
            if (item.width > regionWidth || item.height > regionHeight) return null;

            if (currentRow.items.length === 0) {
                currentRow.items.push(item);
                currentRow.width = item.width;
                currentRow.height = item.height;
                continue;
            }

            const nextWidth = currentRow.width + gap + item.width;
            if (nextWidth <= regionWidth) {
                currentRow.items.push(item);
                currentRow.width = nextWidth;
                currentRow.height = Math.max(currentRow.height, item.height);
                continue;
            }

            flushRow();
            currentRow.items.push(item);
            currentRow.width = item.width;
            currentRow.height = item.height;
        }

        flushRow();

        const totalHeight = rows.reduce((sum, row) => sum + row.height, 0) + (Math.max(0, rows.length - 1) * rowGap);
        if (totalHeight > regionHeight) return null;

        const placed: CloudPlacedItem[] = [];
        let cursorY = -totalHeight / 2;
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            const slack = Math.max(0, regionWidth - row.width);
            const shiftRange = Math.min(slack / 2, slack * params.staggerStrength);
            const rowRng = randomness?.createRng(`cloud-layout:row:${rowIndex}`);
            const rowShift = shiftRange > 0
                ? ((rowRng ? rowRng() : 0.5) - 0.5) * 2 * shiftRange
                : 0;
            let cursorX = (-regionWidth / 2) + (slack / 2) + rowShift;

            for (const item of row.items) {
                placed.push({
                    ...item,
                    x: cursorX,
                    y: cursorY + ((row.height - item.height) / 2),
                });
                cursorX += item.width + gap;
            }

            cursorY += row.height + rowGap;
        }

        const coverage = placed.reduce((sum, item) => sum + (item.width * item.height), 0) / regionArea;
        const bounds = computeBounds(placed);
        return {
            items: placed,
            bounds,
            contentScale,
            coverage,
        };
    };

    const steps = 36;
    const scaleCandidates = Array.from({ length: steps + 1 }, (_, index) => {
        const ratio = index / steps;
        return params.maxFontScale - ((params.maxFontScale - params.minFontScale) * ratio);
    });
    scaleCandidates.push(params.minFontScale * 0.75, params.minFontScale * 0.5, params.minFontScale * 0.25);

    let bestLayout: PackedLayout | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const candidateScale of scaleCandidates) {
        const contentScale = Math.max(0.05, candidateScale);
        const packed = packAtScale(contentScale);
        if (!packed) continue;

        const delta = Math.abs(packed.coverage - params.targetCoverage);
        if (
            !bestLayout
            || delta < bestDelta
            || (Math.abs(delta - bestDelta) < 0.000001 && packed.contentScale > bestLayout.contentScale)
        ) {
            bestLayout = packed;
            bestDelta = delta;
        }
    }

    if (!bestLayout) {
        return {
            items: [],
            bounds: EMPTY_BOUNDS,
            contentScale: Math.max(0.05, params.minFontScale),
            coverage: 0,
        };
    }

    return bestLayout;
};
