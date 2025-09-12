import { shallowRef } from 'vue';

export interface GestureHelpItem {
    id: string;
    keys: string;
    description: string;
    lane?: string;
}

const registryRef = shallowRef<GestureHelpItem[]>([
    { id: 'scrub', keys: 'Click/Drag on Ruler', description: 'Scrub playhead', lane: 'Ruler' },
    { id: 'zoom', keys: 'Cmd/Ctrl + Wheel', description: 'Zoom around cursor', lane: 'Ruler' },
    { id: 'pan', keys: 'Wheel or Shift + Wheel', description: 'Pan horizontally', lane: 'Ruler' },
    { id: 'scene-move', keys: 'Drag scene', description: 'Move scene in time', lane: 'Scenes' },
    { id: 'scene-resize', keys: 'Drag left/right edge', description: 'Resize scene', lane: 'Scenes' },
    { id: 'scene-transition', keys: 'Alt + drag edge', description: 'Adjust transition in/out', lane: 'Scenes' },
]);

export const gestureRegistry = {
    list: registryRef,
    add(item: GestureHelpItem) {
        const arr = [...registryRef.value];
        const idx = arr.findIndex(x => x.id === item.id);
        if (idx >= 0) arr[idx] = item; else arr.push(item);
        registryRef.value = arr;
    },
    remove(id: string) {
        registryRef.value = registryRef.value.filter(x => x.id !== id);
    },
};


