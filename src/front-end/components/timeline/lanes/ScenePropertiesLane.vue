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
  (e: 'scrollToInspector', payload: { propertyPath: string }): void;
}>();

// Collapsible state for each property
const collapsed = ref<Record<string, boolean>>({});

const propertyLanes = computed(() => {
  const arr = Array.isArray(props.tracks) ? props.tracks : [];
  return arr.filter(t => Array.isArray((t as any).keyframes) && (t as any).keyframes.length > 0);
});
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
  
  const pp = Object.keys(selectedIdx.value).find(p => selectedIdx.value[p] != null);
  if (!pp) {
    
    return;
  }
  const idx = selectedIdx.value[pp] as number;
  
  if (!Number.isFinite(idx)) {
    
    return;
  }
  
  emit('deleteKeyframe', { propertyPath: pp, index: idx });
  selectedIdx.value = {}; // Clear selection after delete
};

const hasSelection = computed(() => Object.keys(selectedIdx.value).some(p => selectedIdx.value[p] != null));

// Helper to get current value from track
const getCurrentValue = (propertyPath: string) => {
  const track = propertyLanes.value.find((t: any) => t.propertyPath === propertyPath);
  if (!track || !Array.isArray(track.keyframes) || track.keyframes.length === 0) {
    const meta = metaMap.value[propertyPath];
    return meta?.min ?? 0;
  }
  const currentFrame = props.currentFrame || 0;
  const kfs = track.keyframes;
  let before = null;
  let after = null;
  for (const kf of kfs) {
    if (kf.frame <= currentFrame) before = kf;
    if (kf.frame >= currentFrame && !after) after = kf;
  }
  if (!before && !after) return metaMap.value[propertyPath]?.min ?? 0;
  if (!after) return before.value;
  if (!before || before.frame === after.frame) return after.value;
  const t = (currentFrame - before.frame) / (after.frame - before.frame);
  return before.value + (after.value - before.value) * t;
};

// Button handlers
const handleAddKf = (propertyPath: string) => {
  const frame = props.currentFrame || 0;
  const value = getCurrentValue(propertyPath);
  emit('addKeyframe', { propertyPath, frame, value });
};

const handleResetToDefault = (propertyPath: string) => {
  const frame = props.currentFrame || 0;
  const meta = metaMap.value[propertyPath];
  const def = (meta && 'default' in meta) ? meta.default : 0;
  emit('addKeyframe', { propertyPath, frame, value: def });
};

const handleClearTrack = (propertyPath: string) => {
  const track = propertyLanes.value.find(t => t.propertyPath === propertyPath);
  if (!track || !Array.isArray(track.keyframes)) return;
  // Delete from end to start to preserve indices
  for (let i = track.keyframes.length - 1; i >= 0; i--) {
    emit('deleteKeyframe', { propertyPath, index: i });
  }
  
  // After clearing, add a keyframe with the default value at the current frame
  const meta = metaMap.value[propertyPath];
  if (meta) {
    const frame = props.currentFrame || 0;
    const def = (meta && 'default' in meta) ? meta.default : 0;
    emit('addKeyframe', { propertyPath, frame, value: def });
  }
};

const handleNavPrev = (propertyPath: string) => {
  onNavigate('prevKf', propertyPath);
};

const handleNavNext = (propertyPath: string) => {
  onNavigate('nextKf', propertyPath);
};

// Toggle collapse state
const toggleCollapse = (propertyPath: string) => {
  collapsed.value = { ...collapsed.value, [propertyPath]: !collapsed.value[propertyPath] };
};

// Expose for parent
defineExpose({ onDeleteSelected, onNavigate, hasSelection });

</script>

<template>
  <div class="scene-properties" tabindex="0" @keydown="onKeyDown">
    <div v-if="propertyLanes.length > 0" class="properties-grid">
      <div v-for="t in propertyLanes" 
           :key="t.propertyPath" 
           class="property-row"
           :class="{ 'collapsed': collapsed[t.propertyPath] }"
           :data-property-path="t.propertyPath">
        <div class="property-label" @click="emit('scrollToInspector', { propertyPath: t.propertyPath })">
          <div class="label-header">
            <button type="button" 
                    class="collapse-btn" 
                    @click.stop="toggleCollapse(t.propertyPath)"
                    :title="collapsed[t.propertyPath] ? 'Expand' : 'Collapse'">
              {{ collapsed[t.propertyPath] ? '▸' : '▾' }}
            </button>
            <div class="label-text">{{ metaMap[t.propertyPath]?.label || t.propertyPath }}</div>
          </div>
          <div v-if="!collapsed[t.propertyPath]" class="property-controls">
            <button type="button" class="small" @click.stop="handleNavPrev(t.propertyPath)" title="Previous keyframe">◀</button>
            <button type="button" class="small primary" @click.stop="handleAddKf(t.propertyPath)" title="Add keyframe">◆</button>
            <button type="button" class="small" @click.stop="handleNavNext(t.propertyPath)" title="Next keyframe">▶</button>
            <button type="button" class="small" @click.stop="handleResetToDefault(t.propertyPath)" title="Set to default at playhead">Reset</button>
            <button type="button" class="small danger" @click.stop="handleClearTrack(t.propertyPath)" title="Remove all keyframes for this property">Clear</button>
          </div>
        </div>
        <div class="property-lane">
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
      </div>
    </div>
    <div v-else class="scene-properties__empty">No animatable properties. (Select a scene)</div>
  </div>
  
</template>

<style scoped>
.scene-properties { 
  display: flex; 
  flex-direction: column; 
  height: 100%;
  background: rgba(20, 20, 25, 0.5);
}

.properties-grid {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.property-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 32px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  
  &.collapsed {
    height: 24px;
    min-height: 24px;
    
    .property-lane {
      pointer-events: all;
    }
  }
}

.property-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 4px 12px;
  background: rgba(20, 20, 25, 0.95);
  border-right: 1px solid rgba(0, 212, 255, 0.2);
  cursor: pointer;
  transition: background 0.15s;
  
  &:hover {
    background: rgba(0, 212, 255, 0.08);
  }
  
  .label-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .collapse-btn {
    background: none;
    border: none;
    color: rgba(0, 212, 255, 0.7);
    padding: 0;
    font-size: 10px;
    cursor: pointer;
    line-height: 1;
    transition: color 0.15s;
    
    &:hover {
      color: rgba(0, 212, 255, 1);
    }
  }
  
  .label-text {
    font-size: 10px;
    font-weight: 600;
    color: #ddd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .property-controls {
    display: flex;
    gap: 2px;
    
    button {
      padding: 2px 6px;
      font-size: 10px;
      min-width: auto;
      line-height: 1;
    }
  }
}

.property-lane {
  position: relative;
  height: 100%;
  overflow: visible;
}

.scene-properties__empty { 
  color: #999; 
  font-size: 12px; 
  padding: 20px; 
  text-align: center;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>


