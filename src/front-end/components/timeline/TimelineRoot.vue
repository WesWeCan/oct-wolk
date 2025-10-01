<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import RulerLane from '@/front-end/components/timeline/lanes/RulerLane.vue';
import ScenesLane from '@/front-end/components/timeline/lanes/ScenesLane.vue';
import ActionsLane from '@/front-end/components/timeline/lanes/ActionsLane.vue';
import WordKeyframesLane from '@/front-end/components/timeline/lanes/WordKeyframesLane.vue';
// New AE-style left column scaffold (names + properties)
const showLeftColumn = true;
import WaveformLane from '@/front-end/components/timeline/lanes/WaveformLane.vue';
import EnergyLane from '@/front-end/components/timeline/lanes/EnergyLane.vue';
import BeatsLane from '@/front-end/components/timeline/lanes/BeatsLane.vue';
import BandsLane from '@/front-end/components/timeline/lanes/BandsLane.vue';
import BeatStrengthLane from '@/front-end/components/timeline/lanes/BeatStrengthLane.vue';
import ScenePropertiesLane from '@/front-end/components/timeline/lanes/ScenePropertiesLane.vue';
import { useTimelineViewport } from './useTimelineViewport';
import TimelineHelp from './TimelineHelp.vue';
import type { SceneRef, ActionItem } from '@/types/timeline_types';
import { evalInterpolatedAtFrame } from '@/front-end/utils/tracks';

const props = defineProps<{
    fps: number;
    durationSec?: number;
    currentFrame: number;
    waveform?: number[];
    energyPerFrame?: number[];
    bandsLowPerFrame?: number[];
    bandsMidPerFrame?: number[];
    bandsHighPerFrame?: number[];
    beatStrengthPerFrame?: number[];
    isOnsetPerFrame?: boolean[];
    showEnergy?: boolean;
    showOnsets?: boolean;
    beats?: number[];
    scenes?: SceneRef[];
    selectedSceneId?: string;
    actionItems?: ActionItem[];
    // Global word pool keyframe frames (timeline-level markers)
    wordKeyframes?: number[];
    // Scene property tracks for the selected scene
    scenePropertyTracks?: { propertyPath: string; keyframes: { frame: number; value: any; interpolation?: any }[] }[];
    // Scene property metas and params snapshot for left column controls
    scenePropertyMetas?: { propertyPath: string; label?: string; type?: string; paramKey?: string; min?: number; max?: number; step?: number }[];
    sceneParamSnapshot?: Record<string, any>;
}>();

const emit = defineEmits<{
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'sceneSelect', payload: { id: string }): void;
    (e: 'sceneUpdate', payload: SceneRef): void;
    (e: 'actionToggle', payload: { frame: number }): void;
    (e: 'dragGlobalPoolMarker', payload: { index: number; frame: number; originalFrame: number }): void;
    (e: 'propAddKf', payload: { propertyPath: string; frame: number; value: any }): void;
    (e: 'propMoveKf', payload: { propertyPath: string; index: number; frame: number }): void;
    (e: 'propDeleteKf', payload: { propertyPath: string; index: number }): void;
    (e: 'propChangeValue', payload: { propertyPath: string; value: any }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const scenePropsLaneRef = ref<InstanceType<typeof ScenePropertiesLane> | null>(null);

const vp = useTimelineViewport({ fps: props.fps, durationSec: Math.min(30, Math.max(1, props.durationSec || 60)), totalSec: Math.max(1, props.durationSec || 60) });

watch(() => props.fps, (f) => { vp.viewport.value = { ...vp.viewport.value, fps: Math.max(1, f || 60) }; });
watch(() => props.durationSec, (d) => { if (typeof d === 'number' && d > 0) { vp.setTotal(d); if (vp.viewport.value.durationSec > d) vp.setDuration(Math.max(0.1, Math.min(30, d))); vp.setStart(Math.min(vp.viewport.value.startSec, Math.max(0, d - vp.viewport.value.durationSec))); } });
watch(() => props.currentFrame, (f) => { 
    vp.setPlayhead(f); 
});

const laneHeights = ref<{ [key: string]: number }>({
    ruler: 72,
    scenes: 96,
    actions: 40,
    keyframes: 120,
    'scene-props': 120, // Initial height for scene properties
    waveform: 160,
    energy: 80,
    bands: 80,
    beatstrength: 60,
    
    beats: 80,
});
const collapsed = ref<{ [key: string]: boolean }>({});

const contentHeight = computed(() => Object.entries(laneHeights.value).reduce((sum, [k, h]) => sum + (collapsed.value[k] ? 28 : h), 0));

const onScrub = (p: { timeSec: number; frame: number }) => emit('scrub', p);

const onResize = (lane: string, h: number) => {
    laneHeights.value = { ...laneHeights.value, [lane]: Math.max(24, h) };
};

// Bubble property track events cleanly
const handlePropAddKf = (payload: { propertyPath: string; frame: number; value: any }) => emit('propAddKf', payload);
const handlePropMoveKf = (payload: { propertyPath: string; index: number; frame: number }) => emit('propMoveKf', payload);
const handlePropDeleteKf = (payload: { propertyPath: string; index: number }) => emit('propDeleteKf', payload);
const handlePropChangeValue = (payload: { propertyPath: string; value: any }) => emit('propChangeValue', payload);

// Left column controls for properties
const propertyMetas = computed<any[]>(() => Array.isArray(props.scenePropertyMetas) ? (props.scenePropertyMetas as any[]) : (props.scenePropertyTracks || []).map(t => ({ propertyPath: t.propertyPath })));

// Auto-adjust scene-props lane height based on number of properties
watch(propertyMetas, (metas) => {
    if (metas && metas.length > 0) {
        // Each property row is ~48px (header + controls), plus 40px base padding
        const calculatedHeight = Math.max(120, 40 + metas.length * 48);
        laneHeights.value = { ...laneHeights.value, 'scene-props': calculatedHeight };
    }
}, { immediate: true });

// Get interpolated value at current frame
const getParamValue = (propertyPath: string) => {
    const meta = (propertyMetas.value || []).find((m: any) => m.propertyPath === propertyPath) as any;
    const track = (props.scenePropertyTracks || []).find((t: any) => t.propertyPath === propertyPath);
    const frame = props.currentFrame || 0;
    
    // Use proper interpolation
    const fallback = meta?.default ?? 0;
    return evalInterpolatedAtFrame(track, frame, fallback);
};
const onLeftButtonClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null; if (!target) return;
    const action = target.getAttribute('data-action');
    const propertyPath = target.getAttribute('data-prop') || '';
    
    console.log('[TimelineRoot] onLeftButtonClick:', { action, propertyPath, hasRef: !!scenePropsLaneRef.value });
    
    // Handle delete action (no propertyPath needed)
    if (action === 'delete') {
        console.log('[TimelineRoot] Delete action, calling onDeleteSelected');
        scenePropsLaneRef.value?.onDeleteSelected();
        return;
    }
    
    if (!propertyPath) return;
    const frame = (vp.playhead.value.frame | 0);
    if (action === 'add') {
        handlePropAddKf({ propertyPath, frame, value: getParamValue(propertyPath) });
        return;
    }
    // prev/next navigation - delegate to lane component to handle selection
    if (action === 'prev') {
        scenePropsLaneRef.value?.onNavigate('prevKf', propertyPath);
        return;
    }
    if (action === 'next') {
        scenePropsLaneRef.value?.onNavigate('nextKf', propertyPath);
        return;
    }
};
const onLeftValueChange = (e: Event) => {
    const el = e.target as HTMLInputElement | null; if (!el) return;
    const prop = el.getAttribute('data-prop') || '';
    if (!prop) return;
    const v = el.value;
    const num = Number(v);
    handlePropChangeValue({ propertyPath: prop, value: Number.isFinite(num) ? num : v });
};

// Lane vertical resize via drag handle
const resizing = ref<{ key: string; startY: number; startH: number } | null>(null);
const minHeights: Record<string, number> = { ruler: 48, scenes: 60, actions: 28, keyframes: 80, waveform: 120, energy: 60, bands: 60, beatstrength: 48, beats: 60 };
const startResize = (key: string, e: PointerEvent) => {
    resizing.value = { key, startY: e.clientY, startH: laneHeights.value[key] };
    const onMove = (ev: PointerEvent) => {
        if (!resizing.value) return;
        const dy = ev.clientY - resizing.value.startY;
        const nh = Math.max(minHeights[resizing.value.key] || 24, resizing.value.startH + dy);
        laneHeights.value = { ...laneHeights.value, [resizing.value.key]: nh };
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        resizing.value = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

onMounted(() => {
    // Attach a top-edge resizer to the editor timeline host via pseudo element handler
    const host = document.querySelector('.editor__timeline') as HTMLElement | null;
    hostRef.value = host;
    if (!host) return;
    const onPointerDown = (e: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        if (e.clientY > rect.top + 12) return; // only grab near top edge
        host.classList.add('is-resizing');
        const startH = host.offsetHeight;
        const startY = e.clientY;
        const onMove = (ev: PointerEvent) => {
            const dy = ev.clientY - startY;
            const newH = Math.max(120, Math.min(600, startH - dy));
            host.style.maxHeight = newH + 'px';
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            host.classList.remove('is-resizing');
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };
    host.addEventListener('pointerdown', onPointerDown);
});

// Debug instrumentation for keyframes flow
watch(() => props.wordKeyframes, (m) => {
    const count = Array.isArray(m) ? m.length : 0;
    console.debug('[TimelineRoot] wordKeyframes updated:', { count, sample: (m || []).slice(0, 8) });
}, { deep: true, immediate: true });
watch(() => vp.viewport.value, (v) => {
    console.debug('[TimelineRoot] viewport:', v);
}, { deep: true });

</script>

<template>
    <div ref="containerRef" class="timeline-root" :style="{ '--playhead-x': `${(Math.max(0, Math.min((vp.playhead.value.frame/Math.max(1,fps)) - vp.viewport.value.startSec, vp.viewport.value.durationSec)) / Math.max(1e-6, vp.viewport.value.durationSec)) * 100}%` } as any">
        <div class="timeline-grid" :style="({ display: 'grid', gridTemplateColumns: showLeftColumn ? '220px 1fr' : '1fr' })">
            <div v-if="showLeftColumn" class="timeline-leftcol">
                <div class="lane-label" :style="({ height: `${laneHeights.ruler}px` })">Ruler</div>
                <div class="lane-label" :style="({ height: `${collapsed.scenes ? 28 : laneHeights.scenes}px` })">Scenes</div>
                <div class="lane-label" :style="({ height: `${collapsed.keyframes ? 28 : laneHeights.keyframes}px` })">Word Keyframes</div>
                <div class="lane-label" :style="({ height: `${collapsed['scene-props'] ? 28 : laneHeights['scene-props']}px` })">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span>Properties</span>
                        <button type="button" data-action="delete" @click="onLeftButtonClick" :disabled="!scenePropsLaneRef?.hasSelection" style="font-size: 10px; padding: 2px 6px;">Delete</button>
                    </div>
                    <div class="prop-rows">
                        <div v-for="m in propertyMetas" :key="m.propertyPath" class="prop-row">
                            <div class="prop-row-header">
                                <span class="prop-label">{{ m.label || m.propertyPath }}</span>
                                <span class="prop-value-display" :title="`Interpolated value at frame ${currentFrame}`">{{ typeof getParamValue(m.propertyPath) === 'number' ? getParamValue(m.propertyPath).toFixed(3) : getParamValue(m.propertyPath) }}</span>
                            </div>
                            <div class="prop-controls" @click="onLeftButtonClick" @change="onLeftValueChange">
                                <button type="button" data-action="prev" :data-prop="m.propertyPath">◀</button>
                                <button type="button" data-action="add" :data-prop="m.propertyPath">◆</button>
                                <button type="button" data-action="next" :data-prop="m.propertyPath">▶</button>
                                <input v-if="m.type === 'number' || !m.type" type="number" :min="m.min ?? undefined" :max="m.max ?? undefined" :step="m.step ?? 0.01" :value="typeof getParamValue(m.propertyPath) === 'number' ? Number(getParamValue(m.propertyPath).toFixed(3)) : getParamValue(m.propertyPath)" :data-prop="m.propertyPath" />
                                
                            </div>
                        </div>
                    </div>
                </div>
                <div class="lane-label" :style="({ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` })">Waveform</div>
                <div class="lane-label" :style="({ height: `${collapsed.energy ? 28 : laneHeights.energy}px` })">Energy</div>
                <div class="lane-label" :style="({ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` })">Beat Strength</div>
                <div class="lane-label" :style="({ height: `${collapsed.beats ? 28 : laneHeights.beats}px` })">Beats</div>
                <div class="lane-label" :style="({ height: `${collapsed.bands ? 28 : laneHeights.bands}px` })">Bands</div>
            </div>
            <div>
        <div class="lane lane--ruler-sticky lane--no-resize" :style="{ height: `${laneHeights.ruler}px` }">
            <RulerLane :viewport="vp.viewport.value" :playhead="vp.playhead.value" :beats="beats || []" @scrub="onScrub" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" />
        </div>
        
        
        <!-- Scenes lane -->
        <div class="lane" :style="{ height: `${collapsed.scenes ? 28 : laneHeights.scenes}px` }">
            <div class="lane__header" @click="collapsed.scenes = !collapsed.scenes">
                <span class="twisty">▸</span>
                <span>Scenes</span>
            </div>
            <ScenesLane
                v-if="!collapsed.scenes"
                :viewport="vp.viewport.value"
                :fps="fps"
                :scenes="scenes || []"
                :selected-id="selectedSceneId"
                @select="(id:string) => emit('sceneSelect', { id })"
                @updateScene="(s:any) => emit('sceneUpdate', s)"
                @scrub="(p:any) => emit('scrub', p)"
                @pan="(sec:number) => vp.panBy(sec)"
                @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)"
            />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('scenes', e)"></div>
        </div>

        <!-- Arrange lanes: Waveform, Energy, Beat Strength, Beats, Bands, Keyframes, Actions -->
        <div class="lane" :style="{ height: `${collapsed.keyframes ? 28 : laneHeights.keyframes}px` }">
            <div class="lane__header" @click="collapsed.keyframes = !collapsed.keyframes">
                <span class="twisty">▸</span>
                <span>Word Keyframes</span>
            </div>
            <WordKeyframesLane
                v-if="!collapsed.keyframes"
                :viewport="vp.viewport.value"
                :fps="fps"
                :markers="wordKeyframes || []"
                :beats="beats || []"
                @pan="(sec:number) => vp.panBy(sec)"
                @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)"
                @scrub="(p:any) => emit('scrub', p)"
                @dragMarker="({ index, frame, originalFrame }) => emit('dragGlobalPoolMarker', { index, frame, originalFrame })"
            />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('keyframes', e)"></div>
        </div>
        <!-- Scene properties lane (container of mini-lanes) -->
        <div class="lane" :style="{ height: `${collapsed['scene-props'] ? 28 : laneHeights['scene-props']}px` }">
            <div class="lane__header" @click="collapsed['scene-props'] = !collapsed['scene-props']">
                <span class="twisty">▸</span>
                <span>Properties</span>
            </div>
            <ScenePropertiesLane
                ref="scenePropsLaneRef"
                v-if="!collapsed['scene-props']"
                :viewport="vp.viewport.value"
                :fps="fps"
                :scene-id="selectedSceneId"
                :tracks="(props.scenePropertyTracks || []) as any"
                :metas="(props.scenePropertyMetas || []) as any"
                :current-frame="vp.playhead.value.frame"
                @pan="(sec:number) => vp.panBy(sec)"
                @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)"
                @scrub="(p:any) => emit('scrub', p)"
                @addKeyframe="handlePropAddKf"
                @moveKeyframe="handlePropMoveKf"
                @deleteKeyframe="handlePropDeleteKf"
                @selectKeyframe="() => {}"
            />
        </div>
        <div class="lane" :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }">
            <div class="lane__header" @click="collapsed.waveform = !collapsed.waveform">
                <span class="twisty">▸</span>
                <span>Waveform</span>
            </div>
            <WaveformLane v-if="!collapsed.waveform" :viewport="vp.viewport.value" :fps="fps" :waveform="waveform || []" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('waveform', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.energy ? 28 : laneHeights.energy}px` }">
            <div class="lane__header" @click="collapsed.energy = !collapsed.energy">
                <span class="twisty">▸</span>
                <span>Energy</span>
            </div>
            <EnergyLane v-if="!collapsed.energy" :viewport="vp.viewport.value" :fps="fps" :energy-per-frame="energyPerFrame" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('energy', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` }">
            <div class="lane__header" @click="collapsed.beatstrength = !collapsed.beatstrength">
                <span class="twisty">▸</span>
                <span>Beat Strength</span>
            </div>
            <BeatStrengthLane v-if="!collapsed.beatstrength" :viewport="vp.viewport.value" :fps="fps" :beat-strength-per-frame="beatStrengthPerFrame" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('beatstrength', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.beats ? 28 : laneHeights.beats}px` }">
            <div class="lane__header" @click="collapsed.beats = !collapsed.beats">
                <span class="twisty">▸</span>
                <span>Beats</span>
            </div>
            <BeatsLane v-if="!collapsed.beats" :viewport="vp.viewport.value" :fps="fps" :beats="beats || []" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('beats', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.bands ? 28 : laneHeights.bands}px` }">
            <div class="lane__header" @click="collapsed.bands = !collapsed.bands">
                <span class="twisty">▸</span>
                <span>Bands (Low/Mid/High)</span>
            </div>
            <BandsLane v-if="!collapsed.bands" :viewport="vp.viewport.value" :fps="fps" :low="bandsLowPerFrame" :mid="bandsMidPerFrame" :high="bandsHighPerFrame" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('bands', e)"></div>
        </div>
        
        <!-- <div class="lane" :style="{ height: 'auto' }">
            <TimelineHelp />
        </div> -->
            </div>
        </div>
    </div>
</template>




