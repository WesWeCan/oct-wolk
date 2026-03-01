import { ref, computed } from 'vue';

export interface MarqueeState {
    active: boolean;
    /** Viewport-relative start X in pixels */
    startX: number;
    /** Viewport-relative current X in pixels */
    currentX: number;
    /** Viewport-relative start Y in pixels */
    startY: number;
    /** Viewport-relative current Y in pixels */
    currentY: number;
}

/**
 * Cross-lane selection state for timeline items.
 * Lives in the host (ProjectEditor / TimelineRoot) and is passed down to lanes.
 */
export function useTimelineSelection() {
    const selectedIds = ref<Set<string>>(new Set());
    const marquee = ref<MarqueeState | null>(null);

    const selectedArray = computed(() => Array.from(selectedIds.value));
    const hasSelection = computed(() => selectedIds.value.size > 0);

    const select = (id: string) => {
        selectedIds.value = new Set([id]);
    };

    const toggle = (id: string) => {
        const next = new Set(selectedIds.value);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selectedIds.value = next;
    };

    const addToSelection = (id: string) => {
        const next = new Set(selectedIds.value);
        next.add(id);
        selectedIds.value = next;
    };

    const selectRange = (ids: string[]) => {
        const next = new Set(selectedIds.value);
        for (const id of ids) next.add(id);
        selectedIds.value = next;
    };

    const replaceSelection = (ids: string[]) => {
        selectedIds.value = new Set(ids);
    };

    const clearSelection = () => {
        selectedIds.value = new Set();
    };

    const isSelected = (id: string) => selectedIds.value.has(id);

    const startMarquee = (x: number, y: number) => {
        marquee.value = { active: true, startX: x, currentX: x, startY: y, currentY: y };
    };

    const updateMarquee = (x: number, y: number) => {
        if (!marquee.value) return;
        marquee.value = { ...marquee.value, currentX: x, currentY: y };
    };

    const endMarquee = () => {
        marquee.value = null;
    };

    /** Get the marquee bounding rect in local coordinates */
    const marqueeRect = computed(() => {
        if (!marquee.value) return null;
        const x1 = Math.min(marquee.value.startX, marquee.value.currentX);
        const x2 = Math.max(marquee.value.startX, marquee.value.currentX);
        const y1 = Math.min(marquee.value.startY, marquee.value.currentY);
        const y2 = Math.max(marquee.value.startY, marquee.value.currentY);
        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    });

    return {
        selectedIds,
        selectedArray,
        hasSelection,
        marquee,
        marqueeRect,
        select,
        toggle,
        addToSelection,
        selectRange,
        replaceSelection,
        clearSelection,
        isSelected,
        startMarquee,
        updateMarquee,
        endMarquee,
    };
}
