<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import RulerLane from '@/front-end/components/timeline/lanes/RulerLane.vue';
import ScenesLane from '@/front-end/components/timeline/lanes/ScenesLane.vue';
import ActionsLane from '@/front-end/components/timeline/lanes/ActionsLane.vue';
import WordKeyframesLane from '@/front-end/components/timeline/lanes/WordKeyframesLane.vue';
import PropertyMiniLane from '@/front-end/components/timeline/lanes/PropertyMiniLane.vue';
// New AE-style left column scaffold (names + properties)
const showLeftColumn = true;
import WaveformLane from '@/front-end/components/timeline/lanes/WaveformLane.vue';
import EnergyLane from '@/front-end/components/timeline/lanes/EnergyLane.vue';
import BeatsLane from '@/front-end/components/timeline/lanes/BeatsLane.vue';
import BandsLane from '@/front-end/components/timeline/lanes/BandsLane.vue';
import BeatStrengthLane from '@/front-end/components/timeline/lanes/BeatStrengthLane.vue';
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

const vp = useTimelineViewport({ fps: props.fps, durationSec: Math.min(30, Math.max(1, props.durationSec || 60)), totalSec: Math.max(1, props.durationSec || 60) });

watch(() => props.fps, (f) => { vp.viewport.value = { ...vp.viewport.value, fps: Math.max(1, f || 60) }; });
watch(() => props.durationSec, (d) => { if (typeof d === 'number' && d > 0) { vp.setTotal(d); if (vp.viewport.value.durationSec > d) vp.setDuration(Math.max(0.1, Math.min(30, d))); vp.setStart(Math.min(vp.viewport.value.startSec, Math.max(0, d - vp.viewport.value.durationSec))); } });
watch(() => props.currentFrame, (f) => { 
    vp.setPlayhead(f); 
});

const laneHeights = ref<{ [key: string]: number }>({
    ruler: 48, // Reduced from 72
    scenes: 96,
    actions: 40,
    keyframes: 80, // Reduced from 120
    'scene-props': 96, // Initial height for scene properties (3 rows × 32px)
    waveform: 140, // Slightly reduced
    energy: 70, // Slightly reduced
    bands: 70, // Slightly reduced
    beatstrength: 50, // Slightly reduced
    beats: 70, // Slightly reduced
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

// Property lanes - each property becomes its own lane
const propertyLanes = computed(() => {
    if (!props.selectedSceneId || !Array.isArray(props.scenePropertyTracks) || props.scenePropertyTracks.length === 0) {
        // Empty state - show placeholder
        return [];
    }
    return props.scenePropertyTracks.map((track: any) => {
        const meta = Array.isArray(props.scenePropertyMetas) 
            ? props.scenePropertyMetas.find((m: any) => m.propertyPath === track.propertyPath)
            : null;
        return {
            key: `prop-${track.propertyPath}`,
            propertyPath: track.propertyPath,
            label: meta?.label || track.propertyPath,
            track: track,
            meta: meta
        };
    });
});

// Initialize heights for property lanes
// Calculate minimum height: header (28px) + value display (25px) + buttons (30px) + input (30px) + padding (12px) = 125px
const PROPERTY_LANE_MIN_HEIGHT = 125;

watch(propertyLanes, (lanes) => {
    const newHeights = { ...laneHeights.value };
    lanes.forEach(lane => {
        if (!(lane.key in newHeights)) {
            newHeights[lane.key] = PROPERTY_LANE_MIN_HEIGHT;
        }
    });
    laneHeights.value = newHeights;
}, { immediate: true });

// Get current interpolated value for a property
const getPropertyValue = (propertyPath: string) => {
    const track = props.scenePropertyTracks?.find((t: any) => t.propertyPath === propertyPath);
    if (!track || !Array.isArray(track.keyframes) || track.keyframes.length === 0) return 0;
    
    const currentFrame = props.currentFrame || 0;
    const kfs = track.keyframes;
    let before = null;
    let after = null;
    for (const kf of kfs) {
        if (kf.frame <= currentFrame) before = kf;
        if (kf.frame >= currentFrame && !after) after = kf;
    }
    if (!before && !after) return 0;
    if (!after) return before.value;
    if (!before || before.frame === after.frame) return after.value;
    const t = (currentFrame - before.frame) / (after.frame - before.frame);
    return before.value + (after.value - before.value) * t;
};

// Property lane controls
const handlePropAdd = (propertyPath: string) => {
    const value = getPropertyValue(propertyPath);
    handlePropAddKf({ propertyPath, frame: props.currentFrame || 0, value });
};

const handlePropPrev = (propertyPath: string) => {
    const track = props.scenePropertyTracks?.find((t: any) => t.propertyPath === propertyPath);
    if (!track || !Array.isArray(track.keyframes)) return;
    const frames = track.keyframes.map((k: any) => k.frame).sort((a: number, b: number) => a - b);
    const current = props.currentFrame || 0;
    for (let i = frames.length - 1; i >= 0; i--) {
        if (frames[i] < current) {
            const targetFrame = frames[i];
            emit('scrub', { timeSec: targetFrame / Math.max(1, props.fps), frame: targetFrame });
            return;
        }
    }
};

const handlePropNext = (propertyPath: string) => {
    const track = props.scenePropertyTracks?.find((t: any) => t.propertyPath === propertyPath);
    if (!track || !Array.isArray(track.keyframes)) return;
    const frames = track.keyframes.map((k: any) => k.frame).sort((a: number, b: number) => a - b);
    const current = props.currentFrame || 0;
    for (let i = 0; i < frames.length; i++) {
        if (frames[i] > current) {
            const targetFrame = frames[i];
            emit('scrub', { timeSec: targetFrame / Math.max(1, props.fps), frame: targetFrame });
            return;
        }
    }
};

const handlePropValueChange = (propertyPath: string, value: any) => {
    handlePropChangeValue({ propertyPath, value });
};

// Track selected keyframes per property
const selectedPropertyKeyframes = ref<Record<string, number>>({});

const handlePropDelete = (propertyPath: string) => {
    const selectedIdx = selectedPropertyKeyframes.value[propertyPath];
    if (selectedIdx === undefined || selectedIdx === null || selectedIdx < 0) return;
    handlePropDeleteKf({ propertyPath, index: selectedIdx });
    selectedPropertyKeyframes.value = { ...selectedPropertyKeyframes.value, [propertyPath]: -1 };
};

// Lane vertical resize via drag handle
const resizing = ref<{ key: string; startY: number; startH: number } | null>(null);
const minHeights: Record<string, number> = { ruler: 40, scenes: 60, actions: 28, keyframes: 80, waveform: 120, energy: 60, bands: 60, beatstrength: 48, beats: 60 };
const startResize = (key: string, e: PointerEvent) => {
    resizing.value = { key, startY: e.clientY, startH: laneHeights.value[key] };
    const onMove = (ev: PointerEvent) => {
        if (!resizing.value) return;
        const dy = ev.clientY - resizing.value.startY;
        // For property lanes, use PROPERTY_LANE_MIN_HEIGHT; for others use minHeights or default 24
        const minH = resizing.value.key.startsWith('prop-') ? PROPERTY_LANE_MIN_HEIGHT : (minHeights[resizing.value.key] || 24);
        const nh = Math.max(minH, resizing.value.startH + dy);
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
        <div class="timeline">
            <div class="grid" :style="{ gridTemplateColumns: showLeftColumn ? '220px 1fr' : '1fr' }">
            <div v-if="showLeftColumn" class="leftcol">
                <div class="lane-label ruler-label" :style="{ height: `${laneHeights.ruler}px` }">TIME</div>
                <div 
                    class="lane-label" 
                    :class="{ collapsed: collapsed.keyframes }"
                    :style="{ height: `${collapsed.keyframes ? 28 : laneHeights.keyframes}px` }"
                    @click="collapsed.keyframes = !collapsed.keyframes"
                >
                    WORD POOL KEYFRAMES
                </div>
                <div 
                    class="lane-label" 
                    :class="{ collapsed: collapsed.scenes }"
                    :style="{ height: `${collapsed.scenes ? 28 : laneHeights.scenes}px` }"
                    @click="collapsed.scenes = !collapsed.scenes"
                >
                    SCENES
                </div>

                <!-- Individual property lane labels -->
                <div v-if="propertyLanes.length === 0 && selectedSceneId" class="lane-label empty-props-label" :style="{ height: '60px' }">
                    PROPERTIES
                    <span class="empty-hint">Select a scene to see properties</span>
                </div>
                <div v-for="propLane in propertyLanes" :key="propLane.key" 
                    class="lane-label property-lane-label"
                    :class="{ collapsed: collapsed[propLane.key] }"
                    :style="{ height: `${collapsed[propLane.key] ? 28 : (laneHeights[propLane.key] || PROPERTY_LANE_MIN_HEIGHT)}px` }"
                >
                    <div class="prop-label-header" @click="collapsed[propLane.key] = !collapsed[propLane.key]">
                        <span class="prop-name">{{ propLane.label }}</span>
                    </div>
                    <div v-if="!collapsed[propLane.key]" class="prop-controls" @click.stop>
                        <div class="prop-value-display">{{ getPropertyValue(propLane.propertyPath).toFixed(3) }}</div>
                        <div class="prop-buttons">
                            <button type="button" class="small" @click="handlePropPrev(propLane.propertyPath)" title="Previous keyframe">◀</button>
                            <button type="button" class="small primary" @click="handlePropAdd(propLane.propertyPath)" title="Add keyframe">◆</button>
                            <button type="button" class="small" @click="handlePropNext(propLane.propertyPath)" title="Next keyframe">▶</button>
                            <button type="button" class="small danger" @click="handlePropDelete(propLane.propertyPath)" title="Delete selected keyframe">×</button>
                        </div>
                        <input 
                            type="number" 
                            :value="getPropertyValue(propLane.propertyPath).toFixed(3)"
                            @input="handlePropValueChange(propLane.propertyPath, Number(($event.target as HTMLInputElement).value))"
                            :min="propLane.meta?.min"
                            :max="propLane.meta?.max"
                            :step="propLane.meta?.step || 0.01"
                            class="prop-value-input"
                        />
                    </div>
                </div>
                <div 
                    class="lane-label"
                    :class="{ collapsed: collapsed.waveform }"
                    :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }"
                    @click="collapsed.waveform = !collapsed.waveform"
                >
                    WAVEFORM
                </div>
                <div 
                    class="lane-label"
                    :class="{ collapsed: collapsed.energy }"
                    :style="{ height: `${collapsed.energy ? 28 : laneHeights.energy}px` }"
                    @click="collapsed.energy = !collapsed.energy"
                >
                    ENERGY
                </div>
                <div 
                    class="lane-label"
                    :class="{ collapsed: collapsed.beatstrength }"
                    :style="{ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` }"
                    @click="collapsed.beatstrength = !collapsed.beatstrength"
                >
                    BEAT STRENGTH
                </div>
                <div 
                    class="lane-label"
                    :class="{ collapsed: collapsed.beats }"
                    :style="{ height: `${collapsed.beats ? 28 : laneHeights.beats}px` }"
                    @click="collapsed.beats = !collapsed.beats"
                >
                    BEATS
                </div>
                <div 
                    class="lane-label"
                    :class="{ collapsed: collapsed.bands }"
                    :style="{ height: `${collapsed.bands ? 28 : laneHeights.bands}px` }"
                    @click="collapsed.bands = !collapsed.bands"
                >
                    BANDS
                </div>
            </div>
            <div>
        <div class="lane lane--ruler-sticky lane--no-resize" :style="{ height: `${laneHeights.ruler}px` }">
            <RulerLane :viewport="vp.viewport.value" :playhead="vp.playhead.value" :beats="beats || []" @scrub="onScrub" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" />
        </div>
        
        
     

        <!-- Arrange lanes: Waveform, Energy, Beat Strength, Beats, Bands, Keyframes, Actions -->
        <div class="lane" :style="{ height: `${collapsed.keyframes ? 28 : laneHeights.keyframes}px` }">
            <WordKeyframesLane
                v-if="!collapsed.keyframes"
                :viewport="vp.viewport.value"
                :fps="fps"
                :markers="wordKeyframes || []"
                :beats="beats || []"
                :current-frame="vp.playhead.value.frame"
                @pan="(sec:number) => vp.panBy(sec)"
                @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)"
                @scrub="(p:any) => emit('scrub', p)"
                @dragMarker="({ index, frame, originalFrame }) => emit('dragGlobalPoolMarker', { index, frame, originalFrame })"
            />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('keyframes', e)"></div>
        </div>

           <!-- Scenes lane -->
           <div class="lane" :style="{ height: `${collapsed.scenes ? 28 : laneHeights.scenes}px` }">
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
        <!-- Empty properties placeholder -->
        <div v-if="propertyLanes.length === 0 && selectedSceneId" class="lane lane--no-resize empty-properties-lane" :style="{ height: '60px' }">
            <div class="empty-properties-message">No animatable properties for this scene</div>
        </div>
        
        <!-- Individual property lanes -->
        <div v-for="propLane in propertyLanes" :key="propLane.key" 
            class="lane" 
            :style="{ height: `${collapsed[propLane.key] ? 28 : (laneHeights[propLane.key] || PROPERTY_LANE_MIN_HEIGHT)}px` }">
            <PropertyMiniLane
                v-if="!collapsed[propLane.key]"
                :viewport="vp.viewport.value"
                :fps="fps"
                :property-path="propLane.propertyPath"
                :track="propLane.track"
                :meta="propLane.meta"
                :current-frame="vp.playhead.value.frame"
                :selected-index="selectedPropertyKeyframes[propLane.propertyPath] ?? null"
                @pan="(sec:number) => vp.panBy(sec)"
                @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)"
                @scrub="(p:any) => emit('scrub', p)"
                @moveKeyframe="({ index, frame }) => handlePropMoveKf({ propertyPath: propLane.propertyPath, index, frame })"
                @deleteKeyframe="({ index }) => handlePropDeleteKf({ propertyPath: propLane.propertyPath, index })"
                @selectKeyframe="({ index }) => selectedPropertyKeyframes[propLane.propertyPath] = index"
            />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize(propLane.key, e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }">
            <WaveformLane v-if="!collapsed.waveform" :viewport="vp.viewport.value" :fps="fps" :waveform="waveform || []" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('waveform', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.energy ? 28 : laneHeights.energy}px` }">
            <EnergyLane v-if="!collapsed.energy" :viewport="vp.viewport.value" :fps="fps" :energy-per-frame="energyPerFrame" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('energy', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` }">
            <BeatStrengthLane v-if="!collapsed.beatstrength" :viewport="vp.viewport.value" :fps="fps" :beat-strength-per-frame="beatStrengthPerFrame" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('beatstrength', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.beats ? 28 : laneHeights.beats}px` }">
            <BeatsLane v-if="!collapsed.beats" :viewport="vp.viewport.value" :fps="fps" :beats="beats || []" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('beats', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.bands ? 28 : laneHeights.bands}px` }">
            <BandsLane v-if="!collapsed.bands" :viewport="vp.viewport.value" :fps="fps" :low="bandsLowPerFrame" :mid="bandsMidPerFrame" :high="bandsHighPerFrame" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('bands', e)"></div>
        </div>
        
        <!-- <div class="lane" :style="{ height: 'auto' }">
            <TimelineHelp />
        </div> -->
            </div>
            </div>
        </div>
    </div>
</template>




