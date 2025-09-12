<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import RulerLane from '@/front-end/components/timeline/lanes/RulerLane.vue';
import ScenesLane from '@/front-end/components/timeline/lanes/ScenesLane.vue';
import ActionsLane from '@/front-end/components/timeline/lanes/ActionsLane.vue';
import KeyframesLane from '@/front-end/components/timeline/lanes/KeyframesLane.vue';
import WaveformLane from '@/front-end/components/timeline/lanes/WaveformLane.vue';
import SpectrumLane from '@/front-end/components/timeline/lanes/SpectrumLane.vue';
import { useTimelineViewport } from './useTimelineViewport';
import TimelineHelp from './TimelineHelp.vue';
import type { SceneRef, ActionItem } from '@/types/timeline_types';

const props = defineProps<{
    fps: number;
    durationSec?: number;
    currentFrame: number;
    waveform?: number[];
    spectrum?: number[];
    energyPerFrame?: number[];
    isOnsetPerFrame?: boolean[];
    showEnergy?: boolean;
    showOnsets?: boolean;
    beats?: number[];
    scenes?: SceneRef[];
    selectedSceneId?: string;
    actionItems?: ActionItem[];
}>();

const emit = defineEmits<{
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'sceneSelect', payload: { id: string }): void;
    (e: 'sceneUpdate', payload: SceneRef): void;
    (e: 'actionToggle', payload: { frame: number }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const hostRef = ref<HTMLElement | null>(null);

const vp = useTimelineViewport({ fps: props.fps, durationSec: Math.min(30, Math.max(1, props.durationSec || 60)), totalSec: Math.max(1, props.durationSec || 60) });

watch(() => props.fps, (f) => { vp.viewport.value = { ...vp.viewport.value, fps: Math.max(1, f || 60) }; });
watch(() => props.durationSec, (d) => { if (typeof d === 'number' && d > 0) { vp.setTotal(d); if (vp.viewport.value.durationSec > d) vp.setDuration(Math.max(0.1, Math.min(30, d))); vp.setStart(Math.min(vp.viewport.value.startSec, Math.max(0, d - vp.viewport.value.durationSec))); } });
watch(() => props.currentFrame, (f) => { vp.setPlayhead(f); });

const laneHeights = ref<{ [key: string]: number }>({
    ruler: 72,
    scenes: 96,
    actions: 40,
    keyframes: 120,
    waveform: 220,
    spectrum: 120,
});
const collapsed = ref<{ [key: string]: boolean }>({});

const contentHeight = computed(() => Object.entries(laneHeights.value).reduce((sum, [k, h]) => sum + (collapsed.value[k] ? 28 : h), 0));

const onScrub = (p: { timeSec: number; frame: number }) => emit('scrub', p);

const onResize = (lane: string, h: number) => {
    laneHeights.value = { ...laneHeights.value, [lane]: Math.max(24, h) };
};

// Lane vertical resize via drag handle
const resizing = ref<{ key: string; startY: number; startH: number } | null>(null);
const minHeights: Record<string, number> = { ruler: 48, scenes: 60, actions: 28, keyframes: 80, waveform: 120, spectrum: 80 };
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

</script>

<template>
    <div ref="containerRef" class="timeline-root" :style="{ '--playhead-x': `${(Math.max(0, Math.min((vp.playhead.value.frame/Math.max(1,fps)) - vp.viewport.value.startSec, vp.viewport.value.durationSec)) / Math.max(1e-6, vp.viewport.value.durationSec)) * 100}%` } as any">
        <div class="lane lane--ruler-sticky lane--no-resize" :style="{ height: `${laneHeights.ruler}px` }">
            <RulerLane :viewport="vp.viewport.value" :playhead="vp.playhead.value" :beats="beats || []" @scrub="onScrub" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" />
        </div>
        <div class="lane" :style="{ height: `${collapsed.scenes ? 28 : laneHeights.scenes}px` }">
            <div class="lane__header" @click="collapsed.scenes = !collapsed.scenes">
                <span class="twisty">▸</span>
                <span>Scenes</span>
            </div>
            <ScenesLane v-if="!collapsed.scenes" :viewport="vp.viewport.value" :fps="fps" :scenes="scenes || []" :selected-id="selectedSceneId" @select="(id:string) => emit('sceneSelect',{ id })" @updateScene="(s:any) => emit('sceneUpdate', s)" @scrub="(p:any) => emit('scrub', p)" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('scenes', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.actions ? 28 : laneHeights.actions}px` }">
            <div class="lane__header" @click="collapsed.actions = !collapsed.actions">
                <span class="twisty">▸</span>
                <span>Actions</span>
            </div>
            <ActionsLane v-if="!collapsed.actions" :viewport="vp.viewport.value" :fps="fps" :actions="actionItems || []" @toggle="(frame:number) => emit('actionToggle', { frame })" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('actions', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.keyframes ? 28 : laneHeights.keyframes}px` }">
            <div class="lane__header" @click="collapsed.keyframes = !collapsed.keyframes">
                <span class="twisty">▸</span>
                <span>Keyframes</span>
            </div>
            <KeyframesLane v-if="!collapsed.keyframes" :viewport="vp.viewport.value" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('keyframes', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }">
            <div class="lane__header" @click="collapsed.waveform = !collapsed.waveform">
                <span class="twisty">▸</span>
                <span>Waveform</span>
            </div>
            <WaveformLane v-if="!collapsed.waveform" :viewport="vp.viewport.value" :fps="fps" :waveform="waveform || []" :energy-per-frame="energyPerFrame" :is-onset-per-frame="isOnsetPerFrame" :show-energy="showEnergy" :show-onsets="showOnsets" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('waveform', e)"></div>
        </div>
        <div class="lane" :style="{ height: `${collapsed.spectrum ? 28 : laneHeights.spectrum}px` }">
            <div class="lane__header" @click="collapsed.spectrum = !collapsed.spectrum">
                <span class="twisty">▸</span>
                <span>Spectrum</span>
            </div>
            <SpectrumLane v-if="!collapsed.spectrum" :viewport="vp.viewport.value" :spectrum="spectrum || []" @pan="(sec:number) => vp.panBy(sec)" @zoomAround="({ timeSec, factor }: { timeSec: number; factor: number }) => vp.setZoomAround(timeSec, factor)" @scrub="(p:any) => emit('scrub', p)" />
            <div class="lane-resizer" @pointerdown="(e:any) => startResize('spectrum', e)"></div>
        </div>
        <!-- <div class="lane" :style="{ height: 'auto' }">
            <TimelineHelp />
        </div> -->
    </div>
</template>




