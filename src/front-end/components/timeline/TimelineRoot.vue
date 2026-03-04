<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiChevronDown, mdiChevronLeft, mdiChevronRight, mdiClose, mdiDiamond } from '@mdi/js';
import RulerLane from '@/front-end/components/timeline/lanes/RulerLane.vue';
import ScenesLane from '@/front-end/components/timeline/lanes/ScenesLane.vue';
import ActionsLane from '@/front-end/components/timeline/lanes/ActionsLane.vue';
import WordKeyframesLane from '@/front-end/components/timeline/lanes/WordKeyframesLane.vue';
import PropertyMiniLane from '@/front-end/components/timeline/lanes/PropertyMiniLane.vue';
import SnapOverlay from './SnapOverlay.vue';
const showLeftColumn = true;
import WaveformLane from '@/front-end/components/timeline/lanes/WaveformLane.vue';
import EnergyLane from '@/front-end/components/timeline/lanes/EnergyLane.vue';
import BeatsLane from '@/front-end/components/timeline/lanes/BeatsLane.vue';
import BandsLane from '@/front-end/components/timeline/lanes/BandsLane.vue';
import BeatStrengthLane from '@/front-end/components/timeline/lanes/BeatStrengthLane.vue';
import { useTimelineViewport } from './useTimelineViewport';
import { useSnapEngine, type SnapTarget } from '@/front-end/composables/timeline/useSnapEngine';
import TimelineHelp from './TimelineHelp.vue';
import type { SceneRef, ActionItem } from '@/types/timeline_types';
import { evalInterpolatedAtFrame } from '@/front-end/utils/tracks';

const props = defineProps<{
    fps: number;
    durationSec?: number;
    analyzedDurationSec?: number;
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
    (e: 'pushUndo'): void;
    (e: 'actionToggle', payload: { frame: number }): void;
    (e: 'dragGlobalPoolMarker', payload: { index: number; frame: number; originalFrame: number }): void;
    (e: 'propAddKf', payload: { propertyPath: string; frame: number; value: any }): void;
    (e: 'propMoveKf', payload: { propertyPath: string; index: number; frame: number }): void;
    (e: 'propDeleteKf', payload: { propertyPath: string; index: number }): void;
    (e: 'propChangeValue', payload: { propertyPath: string; value: any }): void;
    (e: 'scrollToInspector', payload: { propertyPath: string }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const hostRef = ref<HTMLElement | null>(null);

const vp = useTimelineViewport({ fps: props.fps, durationSec: Math.min(30, Math.max(1, props.durationSec || 60)), totalSec: Math.max(1, props.analyzedDurationSec || props.durationSec || 60) });

// Snap engine for scene block snapping
const timelineContainerWidth = ref(800);
const snapEngine = useSnapEngine({
    viewport: vp.viewport as any,
    containerWidth: timelineContainerWidth,
});
const sceneSnapTargets = computed<SnapTarget[]>(() => {
    const targets: SnapTarget[] = [];
    const fps = Math.max(1, props.fps);
    for (const s of (props.scenes || [])) {
        const startSec = s.startFrame / fps;
        const endSec = (s.startFrame + s.durationFrames) / fps;
        targets.push(
            { timeSec: startSec, label: 'edge', sourceId: s.id },
            { timeSec: endSec, label: 'edge', sourceId: s.id },
        );
    }
    return targets;
});
const playheadSnapTarget = computed<SnapTarget[]>(() => {
    const phSec = vp.playhead.value.frame / Math.max(1, props.fps);
    return [{ timeSec: phSec, label: 'playhead' }];
});
snapEngine.registerTargets(sceneSnapTargets);
snapEngine.registerTargets(playheadSnapTarget);

let trWidthObserver: ResizeObserver | null = null;

watch(() => props.fps, (f) => { vp.viewport.value = { ...vp.viewport.value, fps: Math.max(1, f || 60) }; });
watch(() => [props.durationSec, props.analyzedDurationSec] as const, ([d, ad]) => { 
    const totalDur = ad || d;
    if (typeof totalDur === 'number' && totalDur > 0) { 
        vp.setTotal(totalDur); 
        if (vp.viewport.value.durationSec > totalDur) vp.setDuration(Math.max(0.1, Math.min(30, totalDur))); 
        vp.setStart(Math.min(vp.viewport.value.startSec, Math.max(0, totalDur - vp.viewport.value.durationSec))); 
    } 
}, { immediate: true });
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
            // Find the actual index in the original keyframes array
            const actualIndex = track.keyframes.findIndex((k: any) => k.frame === targetFrame);
            emit('scrub', { timeSec: targetFrame / Math.max(1, props.fps), frame: targetFrame });
            // Select the keyframe we navigated to
            selectedPropertyKeyframes.value = { ...selectedPropertyKeyframes.value, [propertyPath]: (actualIndex != null && actualIndex >= 0 ? [actualIndex] : []) } as Record<string, number[]>;
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
            // Find the actual index in the original keyframes array
            const actualIndex = track.keyframes.findIndex((k: any) => k.frame === targetFrame);
            emit('scrub', { timeSec: targetFrame / Math.max(1, props.fps), frame: targetFrame });
            // Select the keyframe we navigated to
            selectedPropertyKeyframes.value = { ...selectedPropertyKeyframes.value, [propertyPath]: (actualIndex != null && actualIndex >= 0 ? [actualIndex] : []) } as Record<string, number[]>;
            return;
        }
    }
};

const handlePropValueChange = (propertyPath: string, value: any) => {
    handlePropChangeValue({ propertyPath, value });
};

// Track selected keyframes per property (multi-select)
const selectedPropertyKeyframes = ref<Record<string, number[]>>({});

const handlePropDelete = (propertyPath: string) => {
    const selected = selectedPropertyKeyframes.value[propertyPath];
    if (!Array.isArray(selected) || selected.length === 0) return;
    // Delete in descending order to avoid reindex issues
    const toDelete = [...new Set(selected)].sort((a, b) => b - a);
    for (const index of toDelete) {
        if (index != null && index >= 0) handlePropDeleteKf({ propertyPath, index });
    }
    selectedPropertyKeyframes.value = { ...selectedPropertyKeyframes.value, [propertyPath]: [] };
};

// Batch move handler from mini-lane group drag
const handlePropMoveKfs = ({ propertyPath, indices, deltaFrames }: { propertyPath: string; indices: number[]; deltaFrames: number }) => {
    const track = props.scenePropertyTracks?.find((t: any) => t.propertyPath === propertyPath);
    if (!track || !Array.isArray(track.keyframes) || indices.length === 0 || !Number.isFinite(deltaFrames)) return;
    const sorted = track.keyframes.slice().sort((a: any, b: any) => (a.frame|0) - (b.frame|0));
    for (const i of indices) {
        const kf = sorted[i];
        if (!kf) continue;
        const origIndex = track.keyframes.indexOf(kf);
        if (origIndex < 0) continue;
        const newFrame = Math.max(0, (kf.frame|0) + (deltaFrames|0));
        handlePropMoveKf({ propertyPath, index: origIndex, frame: newFrame });
    }
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

    // Observe right column width for snap threshold
    const rightCol = containerRef.value?.querySelector('.grid > div:last-child') as HTMLElement;
    if (rightCol) {
        timelineContainerWidth.value = rightCol.clientWidth;
        trWidthObserver = new ResizeObserver(entries => {
            for (const entry of entries) timelineContainerWidth.value = entry.contentRect.width;
        });
        trWidthObserver.observe(rightCol);
    }
});

onUnmounted(() => {
    trWidthObserver?.disconnect();
});

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
                    <div class="prop-label-header">
                        
                        <span class="prop-name" @click="emit('scrollToInspector', { propertyPath: propLane.propertyPath })">{{ propLane.label }}</span>
                        <span class="collapse-icon" @click="collapsed[propLane.key] = !collapsed[propLane.key]">
                            <SvgIcon type="mdi" :path="collapsed[propLane.key] ? mdiChevronRight : mdiChevronDown" :size="10" />
                        </span>
                    </div>
                    <div v-if="!collapsed[propLane.key]" class="prop-controls" @click.stop>
                        <!-- <div class="prop-value-display">{{ getPropertyValue(propLane.propertyPath).toFixed(3) }}</div> -->
                        <div class="prop-buttons">
                            <button type="button" class="small" @click="handlePropPrev(propLane.propertyPath)" title="Previous keyframe" aria-label="Previous keyframe">
                                <SvgIcon type="mdi" :path="mdiChevronLeft" :size="12" />
                            </button>
                            <button type="button" class="small primary" @click="handlePropAdd(propLane.propertyPath)" title="Add keyframe" aria-label="Add keyframe">
                                <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                            </button>
                            <button type="button" class="small" @click="handlePropNext(propLane.propertyPath)" title="Next keyframe" aria-label="Next keyframe">
                                <SvgIcon type="mdi" :path="mdiChevronRight" :size="12" />
                            </button>
                        <button type="button" class="small danger" @click="handlePropDelete(propLane.propertyPath)" title="Delete selected keyframe(s)" aria-label="Delete selected keyframes">
                            <SvgIcon type="mdi" :path="mdiClose" :size="12" />
                        </button>
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
            <div style="position: relative">
        <SnapOverlay :snap-lines="snapEngine.activeSnapLines.value" :viewport="vp.viewport.value" />
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
                :snap-find="snapEngine.findSnap"
                :snap-clear="snapEngine.clearSnap"
                :set-interaction="(mode: string) => vp.setInteraction(mode as any)"
                @select="(id:string) => emit('sceneSelect', { id })"
                @updateScene="(s:any) => emit('sceneUpdate', s)"
                @push-undo="() => emit('pushUndo')"
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
            :class="{ 'collapsed': collapsed[propLane.key] }"
            :style="{ height: `${collapsed[propLane.key] ? 28 : (laneHeights[propLane.key] || PROPERTY_LANE_MIN_HEIGHT)}px` }"
            :data-property-path="propLane.propertyPath">
            <PropertyMiniLane
                :viewport="vp.viewport.value"
                :fps="fps"
                :property-path="propLane.propertyPath"
                :track="propLane.track"
                :meta="propLane.meta"
                :current-frame="vp.playhead.value.frame"
                :selected-indices="selectedPropertyKeyframes[propLane.propertyPath] ?? []"
                @pan="(sec:number) => vp.panBy(sec)"
                @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)"
                @scrub="(p:any) => emit('scrub', p)"
                @moveKeyframe="({ index, frame }) => handlePropMoveKf({ propertyPath: propLane.propertyPath, index, frame })"
                @deleteKeyframe="({ index }) => handlePropDeleteKf({ propertyPath: propLane.propertyPath, index })"
                @selectKeyframe="({ index }) => selectedPropertyKeyframes[propLane.propertyPath] = (index != null && index >= 0 ? [index] : [])"
                @selectKeyframes="({ indices }) => selectedPropertyKeyframes[propLane.propertyPath] = indices"
                @moveKeyframesBatch="({ indices, deltaFrames }) => handlePropMoveKfs({ propertyPath: propLane.propertyPath, indices, deltaFrames })"
            />
            <div v-if="!collapsed[propLane.key]" class="lane-resizer" @pointerdown="(e:any) => startResize(propLane.key, e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }">
            <WaveformLane v-if="!collapsed.waveform" :viewport="vp.viewport.value" :fps="fps" :waveform="waveform || []" :analyzed-duration-sec="analyzedDurationSec" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('waveform', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.energy ? 28 : laneHeights.energy}px` }">
            <EnergyLane v-if="!collapsed.energy" :viewport="vp.viewport.value" :fps="fps" :energy-per-frame="energyPerFrame" :analyzed-duration-sec="analyzedDurationSec" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('energy', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` }">
            <BeatStrengthLane v-if="!collapsed.beatstrength" :viewport="vp.viewport.value" :fps="fps" :beat-strength-per-frame="beatStrengthPerFrame" :analyzed-duration-sec="analyzedDurationSec" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('beatstrength', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.beats ? 28 : laneHeights.beats}px` }">
            <BeatsLane v-if="!collapsed.beats" :viewport="vp.viewport.value" :fps="fps" :beats="beats || []" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('beats', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.bands ? 28 : laneHeights.bands}px` }">
            <BandsLane v-if="!collapsed.bands" :viewport="vp.viewport.value" :fps="fps" :low="bandsLowPerFrame" :mid="bandsMidPerFrame" :high="bandsHighPerFrame" :analyzed-duration-sec="analyzedDurationSec" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
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




