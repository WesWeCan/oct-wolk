<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiDiamond } from '@mdi/js';
import type { MotionTrack } from '@/types/project_types';
import type { PropertyTrack, Keyframe } from '@/types/timeline_types';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import { sortKeyframes } from '@/front-end/utils/tracks';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    track: MotionTrack;
    propertyTrack: PropertyTrack;
    selected: boolean;
    playheadFrame: number;
    locked?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'push-undo'): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoom-around', payload: { timeSec: number; factor: number }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const contextMenuKfIdx = ref<number | null>(null);
const contextMenuPos = ref<{ x: number; y: number } | null>(null);

const propDef = computed(() => getPropertyDef(props.propertyTrack.propertyPath));
const label = computed(() => propDef.value?.shortLabel ?? props.propertyTrack.propertyPath.split('.').pop() ?? '?');
const isMoving = computed(() => propDef.value?.kind === 'moving');

const keyframes = computed(() => sortKeyframes(props.propertyTrack.keyframes ?? []));

const blockStartSec = computed(() => props.track.block.startMs / 1000);
const blockEndSec = computed(() => props.track.block.endMs / 1000);

const frameToPercent = (frame: number): number => {
    const sec = frame / Math.max(1, props.fps);
    return ((sec - props.viewport.startSec) / props.viewport.durationSec) * 100;
};

const pixelToFrame = (px: number): number => {
    const el = containerRef.value;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const pct = (px - rect.left) / rect.width;
    const sec = props.viewport.startSec + pct * props.viewport.durationSec;
    return Math.round(sec * props.fps);
};

const blockLeftPct = computed(() =>
    ((blockStartSec.value - props.viewport.startSec) / props.viewport.durationSec) * 100,
);
const blockWidthPct = computed(() =>
    ((blockEndSec.value - blockStartSec.value) / props.viewport.durationSec) * 100,
);

const emitUpdatedPropertyTrack = (updated: PropertyTrack) => {
    const newTracks = props.track.block.propertyTracks.map(pt =>
        pt.propertyPath === updated.propertyPath ? updated : pt,
    );
    emit('update-track', {
        ...props.track,
        block: { ...props.track.block, propertyTracks: newTracks },
    });
};

const onLaneClick = (e: MouseEvent) => {
    if (props.locked) return;
    if ((e.target as HTMLElement).closest('.kf-marker')) return;
    closeContextMenu();
    const frame = pixelToFrame(e.clientX);
    const def = propDef.value;
    if (!def) return;
    emit('push-undo');
    const value = def.getValue(props.track.block);
    const interp = def.defaultInterpolation;
    const kf: Keyframe = { frame, value, interpolation: interp };
    const list = [...(props.propertyTrack.keyframes ?? []), kf];
    emitUpdatedPropertyTrack({ ...props.propertyTrack, keyframes: list });
};

const onKeyframeDoubleClick = (idx: number, e: MouseEvent) => {
    if (props.locked) return;
    e.stopPropagation();
    closeContextMenu();
    emit('push-undo');
    const list = [...(props.propertyTrack.keyframes ?? [])];
    list.splice(idx, 1);
    emitUpdatedPropertyTrack({ ...props.propertyTrack, keyframes: list });
};

const onKeyframeContextMenu = (idx: number, e: MouseEvent) => {
    if (props.locked) return;
    e.preventDefault();
    e.stopPropagation();
    contextMenuKfIdx.value = idx;
    contextMenuPos.value = { x: e.clientX, y: e.clientY };
};

const closeContextMenu = () => {
    contextMenuKfIdx.value = null;
    contextMenuPos.value = null;
};

const setInterpolation = (interp: string) => {
    if (contextMenuKfIdx.value === null) return;
    emit('push-undo');
    const sorted = sortKeyframes([...(props.propertyTrack.keyframes ?? [])]);
    const idx = contextMenuKfIdx.value;
    if (idx >= 0 && idx < sorted.length) {
        sorted[idx] = { ...sorted[idx], interpolation: interp as any };
        emitUpdatedPropertyTrack({ ...props.propertyTrack, keyframes: sorted });
    }
    closeContextMenu();
};

const deleteFromContextMenu = () => {
    if (contextMenuKfIdx.value === null) return;
    emit('push-undo');
    const sorted = sortKeyframes([...(props.propertyTrack.keyframes ?? [])]);
    sorted.splice(contextMenuKfIdx.value, 1);
    emitUpdatedPropertyTrack({ ...props.propertyTrack, keyframes: sorted });
    closeContextMenu();
};

let dragIdx = -1;
let dragStartX = 0;
let dragOriginalFrame = 0;

const onKeyframePointerDown = (idx: number, e: PointerEvent) => {
    if (props.locked) return;
    e.stopPropagation();
    closeContextMenu();
    dragIdx = idx;
    dragStartX = e.clientX;
    const sorted = sortKeyframes([...(props.propertyTrack.keyframes ?? [])]);
    dragOriginalFrame = sorted[idx]?.frame ?? 0;
    emit('push-undo');

    const onMove = (ev: PointerEvent) => {
        const el = containerRef.value;
        if (!el) return;
        const deltaPx = ev.clientX - dragStartX;
        const deltaSec = (deltaPx / el.clientWidth) * props.viewport.durationSec;
        const deltaFrames = Math.round(deltaSec * props.fps);
        const newFrame = Math.max(0, dragOriginalFrame + deltaFrames);
        const sorted = sortKeyframes([...(props.propertyTrack.keyframes ?? [])]);
        if (dragIdx >= 0 && dragIdx < sorted.length) {
            sorted[dragIdx] = { ...sorted[dragIdx], frame: newFrame };
            emitUpdatedPropertyTrack({ ...props.propertyTrack, keyframes: sorted });
        }
    };

    const onUp = () => {
        dragIdx = -1;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

const interpTypes = [
    { value: 'linear', label: 'Linear' },
    { value: 'easeIn', label: 'Ease In' },
    { value: 'easeOut', label: 'Ease Out' },
    { value: 'easeInOut', label: 'Ease In-Out' },
    { value: 'easeInCubic', label: 'Ease In Cubic' },
    { value: 'easeOutCubic', label: 'Ease Out Cubic' },
    { value: 'step', label: 'Step (Instant)' },
];

useLaneInteractions(containerRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoom-around', { timeSec: t, factor: f }),
    enableScrub: false,
});

const onGlobalClick = () => closeContextMenu();
onMounted(() => window.addEventListener('pointerdown', onGlobalClick));
onUnmounted(() => window.removeEventListener('pointerdown', onGlobalClick));
</script>

<template>
    <div
        ref="containerRef"
        class="property-keyframe-lane"
        :class="{ selected, locked: !!locked }"
        @click="onLaneClick"
    >
        <span class="property-keyframe-lane__label">{{ label }}</span>

        <!-- Block range background -->
        <div class="property-keyframe-lane__range" :style="{ left: blockLeftPct + '%', width: blockWidthPct + '%' }"></div>

        <!-- Connection lines between moving keyframes -->
        <template v-if="isMoving">
            <div
                v-for="(kf, i) in keyframes.slice(0, -1)"
                :key="'line-' + i"
                class="kf-connection"
                :class="{ step: kf.interpolation === 'step' }"
                :style="{
                    left: frameToPercent(kf.frame) + '%',
                    width: (frameToPercent(keyframes[i + 1].frame) - frameToPercent(kf.frame)) + '%',
                }"
            ></div>
        </template>

        <!-- Keyframe diamonds -->
        <div
            v-for="(kf, i) in keyframes"
            :key="'kf-' + i"
            class="kf-marker"
            :class="{ 'at-playhead': kf.frame === playheadFrame, step: kf.interpolation === 'step' }"
            :style="{ left: frameToPercent(kf.frame) + '%' }"
            :title="'Frame ' + kf.frame + ' = ' + kf.value"
            @pointerdown.stop="onKeyframePointerDown(i, $event)"
            @dblclick="onKeyframeDoubleClick(i, $event)"
            @contextmenu="onKeyframeContextMenu(i, $event)"
        >
            <SvgIcon type="mdi" :path="mdiDiamond" :size="10" />
        </div>

        <!-- Context menu -->
        <Teleport to="body">
            <div
                v-if="contextMenuPos"
                class="kf-context-menu"
                :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }"
                @pointerdown.stop
                @click.stop
            >
                <button
                    v-for="it in interpTypes"
                    :key="it.value"
                    class="kf-context-menu__item"
                    :class="{ active: contextMenuKfIdx !== null && keyframes[contextMenuKfIdx]?.interpolation === it.value }"
                    @click="setInterpolation(it.value)"
                >{{ it.label }}</button>
                <div class="kf-context-menu__divider"></div>
                <button class="kf-context-menu__item danger" @click="deleteFromContextMenu">Delete</button>
            </div>
        </Teleport>
    </div>
</template>
