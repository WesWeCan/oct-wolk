<script setup lang="ts">
import { computed, ref } from 'vue';
import PropertyMiniLane from './PropertyMiniLane.vue';

const props = defineProps<{
  viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number };
  fps: number;
  sceneId?: string;
  tracks?: { propertyPath: string; keyframes: { frame: number; value: any; interpolation?: any }[] }[];
  metas?: { propertyPath: string; label?: string; type?: string; paramKey?: string; min?: number; max?: number; step?: number }[];
  currentFrame?: number;
}>();

const emit = defineEmits<{
  (e: 'pan', secDelta: number): void;
  (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
  (e: 'scrub', payload: { timeSec: number; frame: number }): void;
  (e: 'addKeyframe', payload: { propertyPath: string; frame: number; value: any }): void;
  (e: 'moveKeyframe', payload: { propertyPath: string; index: number; frame: number }): void;
  (e: 'deleteKeyframe', payload: { propertyPath: string; index: number }): void;
  (e: 'selectKeyframe', payload: any): void;
  (e: 'navigate', payload: { dir: 'prevKf' | 'nextKf'; propertyPath: string }): void;
}>();

const propertyLanes = computed(() => Array.isArray(props.tracks) ? props.tracks : []);
const metaMap = computed<Record<string, any>>(() => {
  const out: Record<string, any> = {};
  (props.metas || []).forEach(m => { out[m.propertyPath] = m; });
  return out;
});
const selectedIdx = ref<Record<string, number | null>>({});

const onSelectKeyframe = (pp: string, i: number) => {
  selectedIdx.value = { ...selectedIdx.value, [pp]: i };
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return;
  const pp = Object.keys(selectedIdx.value).find(p => selectedIdx.value[p] != null);
  if (!pp) return;
  const idx = selectedIdx.value[pp] as number;
  if (!Number.isFinite(idx)) return;
  emit('deleteKeyframe', { propertyPath: pp, index: idx });
  selectedIdx.value = {}; // Clear selection after delete
};

const onNavigate = (dir: 'prevKf' | 'nextKf', pp: string) => {
  const track = propertyLanes.value.find(t => t.propertyPath === pp);
  if (!track || !Array.isArray(track.keyframes)) return;
  const frames = track.keyframes.map(k => k.frame).sort((a, b) => a - b);
  const current = props.currentFrame || 0;
  let targetIdx = -1;
  if (dir === 'prevKf') {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i] < current) { targetIdx = i; break; }
    }
  } else {
    for (let i = 0; i < frames.length; i++) {
      if (frames[i] > current) { targetIdx = i; break; }
    }
  }
  if (targetIdx >= 0) {
    const frame = frames[targetIdx];
    const fps = Math.max(1, props.fps);
    emit('scrub', { timeSec: frame / fps, frame });
    emit('selectKeyframe', { propertyPath: pp, index: targetIdx });
    selectedIdx.value = { [pp]: targetIdx };
  }
};

const onDeleteSelected = () => {
  console.log('[ScenePropertiesLane] onDeleteSelected called, selectedIdx:', selectedIdx.value);
  const pp = Object.keys(selectedIdx.value).find(p => selectedIdx.value[p] != null);
  if (!pp) {
    console.log('[ScenePropertiesLane] No property path found with selection');
    return;
  }
  const idx = selectedIdx.value[pp] as number;
  console.log('[ScenePropertiesLane] Found selection:', { pp, idx });
  if (!Number.isFinite(idx)) {
    console.log('[ScenePropertiesLane] Index is not finite:', idx);
    return;
  }
  console.log('[ScenePropertiesLane] Emitting deleteKeyframe:', { propertyPath: pp, index: idx });
  emit('deleteKeyframe', { propertyPath: pp, index: idx });
  selectedIdx.value = {}; // Clear selection after delete
};

const hasSelection = computed(() => Object.keys(selectedIdx.value).some(p => selectedIdx.value[p] != null));

// Expose for parent
defineExpose({ onDeleteSelected, onNavigate, hasSelection });

</script>

<template>
  <div class="scene-properties" tabindex="0" @keydown="onKeyDown">
    <div v-for="t in propertyLanes" :key="t.propertyPath" class="scene-properties__row">
      <PropertyMiniLane
        :viewport="props.viewport"
        :fps="fps"
        :property-path="t.propertyPath"
        :track="t"
        :meta="metaMap[t.propertyPath]"
        :current-frame="props.currentFrame"
        :selected-index="selectedIdx[t.propertyPath] ?? null"
        @pan="(d) => emit('pan', d)"
        @zoomAround="(p) => emit('zoomAround', p)"
        @scrub="(p) => emit('scrub', p)"
        @selectKeyframe="({ index }) => onSelectKeyframe(t.propertyPath, index)"
        @moveKeyframe="({ index, frame }) => emit('moveKeyframe', { propertyPath: t.propertyPath, index, frame })"
        @deleteKeyframe="({ index }) => emit('deleteKeyframe', { propertyPath: t.propertyPath, index })"
      />
    </div>
    <div v-if="!propertyLanes.length" class="scene-properties__empty">No animatable properties. (Select a scene)</div>
  </div>
  
</template>

<style scoped>
.scene-properties { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
.scene-properties__row { height: 28px; }
.scene-properties__empty { color: #999; font-size: 12px; padding: 4px 8px; }
</style>


