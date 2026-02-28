import { ref } from 'vue';

const MAX_HISTORY = 50;
const THROTTLE_MS = 300;

/**
 * Snapshot-based undo/redo for any serializable state.
 * Push snapshots after meaningful edits; undo/redo restores them.
 */
export function useUndoRedo<T>() {
    const history = ref<string[]>([]);
    const pointer = ref(-1);
    let lastPushTime = 0;

    const canUndo = () => pointer.value > 0;
    const canRedo = () => pointer.value < history.value.length - 1;

    const pushSnapshot = (state: T, force = false) => {
        const now = Date.now();
        if (!force && now - lastPushTime < THROTTLE_MS) return;
        lastPushTime = now;

        const json = JSON.stringify(state);
        if (pointer.value >= 0 && history.value[pointer.value] === json) return;

        // Discard redo branch
        history.value = history.value.slice(0, pointer.value + 1);
        history.value.push(json);

        if (history.value.length > MAX_HISTORY) {
            history.value = history.value.slice(history.value.length - MAX_HISTORY);
        }
        pointer.value = history.value.length - 1;
    };

    const undo = (): T | null => {
        if (!canUndo()) return null;
        pointer.value--;
        return JSON.parse(history.value[pointer.value]) as T;
    };

    const redo = (): T | null => {
        if (!canRedo()) return null;
        pointer.value++;
        return JSON.parse(history.value[pointer.value]) as T;
    };

    const clear = () => {
        history.value = [];
        pointer.value = -1;
    };

    return { pushSnapshot, undo, redo, canUndo, canRedo, clear };
}
