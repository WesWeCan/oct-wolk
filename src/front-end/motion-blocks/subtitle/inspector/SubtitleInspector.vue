<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { LyricTrack, MotionTrack, MotionStyle, MotionTransform, MotionEnterExit, AnchorX, AnchorY, ItemOverride, WolkProjectFont } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import MotionAppearanceTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAppearanceTab.vue';
import MotionPositionTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionPositionTab.vue';
import MotionAnimationTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue';
import MotionSafeAreaTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionSafeAreaTab.vue';
import MotionItemsTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionItemsTab.vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import MotionPresetPanel from '@/front-end/components/editor/motion/MotionPresetPanel.vue';
import { upsertKeyframe, removeKeyframeAtIndex, evalInterpolatedAtFrame } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import type { MotionFontSelection } from '@/front-end/utils/fonts/fontUtils';
import { applyFontSelectionToMotionStyle } from '@/front-end/utils/fonts/fontUtils';
import { subtitleMotionPresetAdapter } from '@/front-end/motion-blocks/subtitle/presets';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    playheadMs?: number;
    fps?: number;
    projectFont?: WolkProjectFont;
    renderWidth?: number;
    renderHeight?: number;
    rendererBounds?: RendererBounds | null;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
}>();

const clampOffsetToConstraintRegion = (
    offset: number,
    anchor: 'left' | 'center' | 'right' | 'top' | 'bottom',
    padding: number,
    canvasSize: number,
    regionOffset: number = 0,
): number => {
    const min = padding + regionOffset;
    const max = canvasSize - padding + regionOffset;

    let anchorPos: number;
    if (anchor === 'left' || anchor === 'top') anchorPos = min;
    else if (anchor === 'right' || anchor === 'bottom') anchorPos = max;
    else anchorPos = (min + max) / 2;

    return Math.max(min - anchorPos, Math.min(max - anchorPos, offset));
};

const resolveReferenceBasePoint = (
    anchorX: AnchorX,
    anchorY: AnchorY,
    track: MotionTrack,
    renderWidth?: number,
    renderHeight?: number,
): { x: number; y: number } => {
    const width = renderWidth ?? 0;
    const height = renderHeight ?? 0;
    const style = track.block.style;
    const inConstraintRegion = (style.boundsMode ?? 'safeArea') === 'safeArea';
    const left = inConstraintRegion ? (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetX ?? 0) : 0;
    const right = inConstraintRegion ? width - (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetX ?? 0) : width;
    const top = inConstraintRegion ? (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetY ?? 0) : 0;
    const bottom = inConstraintRegion ? height - (style.safeAreaPadding ?? 40) + (style.safeAreaOffsetY ?? 0) : height;

    return {
        x: anchorX === 'left' ? left : anchorX === 'right' ? right : (left + right) / 2,
        y: anchorY === 'top' ? top : anchorY === 'bottom' ? bottom : (top + bottom) / 2,
    };
};

const rotateScalePoint = (x: number, y: number, rotationDeg: number, scale: number) => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: (x * cos - y * sin) * scale,
        y: (x * sin + y * cos) * scale,
    };
};

const selectedItemId = ref<string | null>(null);
const selectedWordIndex = ref<number | null>(null);
const inspectorRoot = ref<HTMLElement | null>(null);

const sourceMissing = computed(() => {
    if (!props.motionTrack) return false;
    return !props.lyricTracks.some((track) => track.id === props.motionTrack!.block.sourceTrackId);
});

const currentFrame = computed(() => {
    const ms = props.playheadMs ?? 0;
    return Math.round((ms / 1000) * Math.max(1, props.fps ?? 60));
});

const fpsVal = computed(() => Math.max(1, props.fps ?? 60));
const isLocked = computed(() => !!props.motionTrack?.locked);

const startFrame = computed(() => {
    if (!props.motionTrack) return 0;
    return Math.round((props.motionTrack.block.startMs / 1000) * fpsVal.value);
});

const endFrame = computed(() => {
    if (!props.motionTrack) return 0;
    return Math.round((props.motionTrack.block.endMs / 1000) * fpsVal.value);
});

const formatFrameAndMs = (frame: number, ms: number): string => {
    return `Frame ${Math.max(0, Math.round(frame))} (${Math.max(0, Math.round(ms))} ms)`;
};

const editingItemLabel = computed(() => {
    if (!selectedItemId.value || !props.motionTrack) return null;
    const src = props.lyricTracks.find((t) => t.id === props.motionTrack!.block.sourceTrackId);
    return src?.items.find((i) => i.id === selectedItemId.value)?.text ?? null;
});

const selectedItemWords = computed<string[]>(() => {
    if (!editingItemLabel.value) return [];
    return editingItemLabel.value.split(/\s+/).filter(Boolean);
});

const selectedItem = computed(() => {
    if (!selectedItemId.value || !props.motionTrack) return null;
    const src = props.lyricTracks.find((t) => t.id === props.motionTrack!.block.sourceTrackId);
    return src?.items.find((i) => i.id === selectedItemId.value) ?? null;
});

const selectedItemOverride = computed(() => {
    if (!selectedItemId.value || !props.motionTrack) return null;
    return props.motionTrack.block.overrides.find((o) => o.sourceItemId === selectedItemId.value) ?? null;
});

const selectedItemTextOverride = computed(() => selectedItemOverride.value?.textOverride ?? '');
const selectedItemStyleOverride = computed(() => !!selectedItemOverride.value?.styleOverride);
const selectedItemTransformOverride = computed(() => !!selectedItemOverride.value?.transformOverride);
const selectedItemAnimationOverride = computed(() => !!(selectedItemOverride.value?.enterOverride || selectedItemOverride.value?.exitOverride));
const selectedItemTextHasOverride = computed(() => !!selectedItemOverride.value?.textOverride);
const blockPresetDisabledMessage = computed(() => {
    if (isLocked.value) return 'Unlock the motion track to apply or save presets.';
    if (selectedItemId.value) return 'Presets apply to the whole block. Clear the item selection to use them.';
    return '';
});

const mergeEnterExitForEditor = (
    base: MotionEnterExit,
    override?: Partial<MotionEnterExit>,
): MotionEnterExit => {
    if (!override) return base;
    const mergedFade = {
        enabled: override.fade?.enabled ?? base.fade.enabled,
        opacityStart: override.fade?.opacityStart ?? base.fade.opacityStart,
        opacityEnd: override.fade?.opacityEnd ?? base.fade.opacityEnd,
    };
    const mergedMove = {
        enabled: override.move?.enabled ?? base.move.enabled,
        direction: override.move?.direction ?? base.move.direction,
        distancePx: override.move?.distancePx ?? base.move.distancePx,
    };
    const mergedScale = {
        enabled: override.scale?.enabled ?? base.scale.enabled,
        amount: override.scale?.amount ?? base.scale.amount,
    };
    return {
        ...base,
        ...override,
        fade: mergedFade,
        move: mergedMove,
        scale: mergedScale,
    };
};

const selectedItemEnterValue = computed<MotionEnterExit | null>(() => {
    if (!props.motionTrack || !selectedItemId.value) return null;
    const override = selectedItemOverride.value?.enterOverride;
    return mergeEnterExitForEditor(props.motionTrack.block.enter, override);
});

const selectedItemExitValue = computed<MotionEnterExit | null>(() => {
    if (!props.motionTrack || !selectedItemId.value) return null;
    const override = selectedItemOverride.value?.exitOverride;
    return mergeEnterExitForEditor(props.motionTrack.block.exit, override);
});

const updateSourceTrack = (sourceTrackId: string) => {
    if (!props.motionTrack || isLocked.value) return;
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, sourceTrackId } });
};

const updateBlockType = (type: MotionTrack['block']['type']) => {
    if (!props.motionTrack || isLocked.value) return;
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, type } });
};

const updateStartFrame = (frame: number) => {
    if (!props.motionTrack || isLocked.value) return;
    const startMs = Math.max(0, Math.round((frame / fpsVal.value) * 1000));
    const endMs = Math.max(startMs + 100, props.motionTrack.block.endMs);
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, startMs, endMs } });
};

const updateEndFrame = (frame: number) => {
    if (!props.motionTrack || isLocked.value) return;
    const endMs = Math.round((frame / fpsVal.value) * 1000);
    const minEnd = props.motionTrack.block.startMs + 100;
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, endMs: Math.max(minEnd, endMs) } });
};

const applyMotionPreset = (track: MotionTrack) => {
    emit('update-track', track);
};

const autoKeyframe = (path: string, value: any, propertyTracks: any[]): any[] => {
    const ptIdx = propertyTracks.findIndex((pt: any) => pt.propertyPath === path);
    if (ptIdx < 0) return propertyTracks;
    if (propertyTracks[ptIdx].enabled === false) return propertyTracks;
    if (!propertyTracks[ptIdx].keyframes?.length) return propertyTracks;
    const def = getPropertyDef(path);
    const interp = def?.defaultInterpolation ?? 'linear';
    const updated = [...propertyTracks];
    updated[ptIdx] = upsertKeyframe(updated[ptIdx] as any, currentFrame.value, value, interp) as any;
    return updated;
};

const updateStyle = (key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedWordIndex.value !== null && selectedItemId.value) {
        updateWordStyle(key, value);
        return;
    }
    if (selectedItemId.value) {
        updateItemStyleOverride(selectedItemId.value, key, value);
        return;
    }
    const block = { ...props.motionTrack.block };
    block.style = { ...block.style, [key]: value };
    block.propertyTracks = autoKeyframe(`style.${key}`, value, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const updateFontSelection = (selection: MotionFontSelection) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedWordIndex.value !== null && selectedItemId.value) {
        const entries: Array<[keyof MotionStyle, any]> = [
            ['fontFamily', selection.family],
            ['fontFallbacks', selection.fallbacks],
            ['fontStyle', selection.style],
            ['fontWeight', selection.weight],
            ['fontName', selection.name],
            ['fontLocalPath', selection.localPath],
        ];
        for (const [key, value] of entries) updateWordStyle(key, value);
        return;
    }
    if (selectedItemId.value) {
        const nextStyle = applyFontSelectionToMotionStyle(
            { ...props.motionTrack.block.style, ...(selectedItemOverride.value?.styleOverride || {}) },
            selection,
        );
        const entries = Object.entries({
            fontFamily: nextStyle.fontFamily,
            fontFallbacks: nextStyle.fontFallbacks,
            fontStyle: nextStyle.fontStyle,
            fontWeight: nextStyle.fontWeight,
            fontName: nextStyle.fontName,
            fontLocalPath: nextStyle.fontLocalPath,
        }) as Array<[keyof MotionStyle, any]>;
        for (const [key, value] of entries) updateItemStyleOverride(selectedItemId.value, key, value);
        return;
    }
    const block = { ...props.motionTrack.block };
    block.style = applyFontSelectionToMotionStyle(block.style, selection);
    block.propertyTracks = autoKeyframe('style.fontFamily', selection.family, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const updateTransform = (key: keyof MotionTransform, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedItemId.value) {
        updateItemTransformOverride(selectedItemId.value, key, value);
        return;
    }
    const block = { ...props.motionTrack.block };
    if ((key === 'offsetX' || key === 'offsetY') && (block.style.boundsMode ?? 'safeArea') === 'safeArea') {
        const padding = block.style.safeAreaPadding ?? 40;
        const regionOffsetX = block.style.safeAreaOffsetX ?? 0;
        const regionOffsetY = block.style.safeAreaOffsetY ?? 0;
        if (key === 'offsetX' && props.renderWidth) {
            value = clampOffsetToConstraintRegion(value, block.transform.anchorX, padding, props.renderWidth, regionOffsetX);
        }
        if (key === 'offsetY' && props.renderHeight) {
            value = clampOffsetToConstraintRegion(value, block.transform.anchorY, padding, props.renderHeight, regionOffsetY);
        }
    }
    block.transform = { ...block.transform, [key]: value };
    block.propertyTracks = autoKeyframe(`transform.${key}`, value, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const updateAnchor = (x: AnchorX, y: AnchorY) => {
    if (!props.motionTrack || isLocked.value) return;
    const nextTransform = { ...props.motionTrack.block.transform, anchorX: x, anchorY: y };

    if (props.rendererBounds && props.renderWidth && props.renderHeight) {
        const bounds = props.rendererBounds;
        const targetLocalX = x === 'left'
            ? bounds.localBoxX
            : x === 'right'
                ? bounds.localBoxX + bounds.localBoxWidth
                : bounds.localBoxX + (bounds.localBoxWidth / 2);
        const targetLocalY = y === 'top'
            ? bounds.localBoxY
            : y === 'bottom'
                ? bounds.localBoxY + bounds.localBoxHeight
                : bounds.localBoxY + (bounds.localBoxHeight / 2);
        const targetDelta = rotateScalePoint(targetLocalX, targetLocalY, bounds.rotation, bounds.scale);
        const desiredReferenceX = bounds.referenceX + targetDelta.x;
        const desiredReferenceY = bounds.referenceY + targetDelta.y;
        const basePoint = resolveReferenceBasePoint(x, y, props.motionTrack, props.renderWidth, props.renderHeight);

        nextTransform.offsetX = Math.round(desiredReferenceX - basePoint.x);
        nextTransform.offsetY = Math.round(desiredReferenceY - basePoint.y);

        if ((props.motionTrack.block.style.boundsMode ?? 'safeArea') === 'safeArea') {
            const padding = props.motionTrack.block.style.safeAreaPadding ?? 40;
            const regionOffsetX = props.motionTrack.block.style.safeAreaOffsetX ?? 0;
            const regionOffsetY = props.motionTrack.block.style.safeAreaOffsetY ?? 0;
            nextTransform.offsetX = clampOffsetToConstraintRegion(nextTransform.offsetX, x, padding, props.renderWidth, regionOffsetX);
            nextTransform.offsetY = clampOffsetToConstraintRegion(nextTransform.offsetY, y, padding, props.renderHeight, regionOffsetY);
        }
    }

    emit('update-track', {
        ...props.motionTrack,
        block: { ...props.motionTrack.block, transform: nextTransform },
    });
};

const cloneEnterExit = (value: MotionEnterExit): MotionEnterExit => ({
    ...value,
    fade: value.fade ? { ...value.fade } : value.fade,
    move: value.move ? { ...value.move } : value.move,
    scale: value.scale ? { ...value.scale } : value.scale,
});

const updateEnterExit = (which: 'enter' | 'exit', value: MotionEnterExit) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedItemId.value) {
        const overrideKey = which === 'enter' ? 'enterOverride' : 'exitOverride';
        const { overrides, idx } = getOrCreateOverride(selectedItemId.value);
        overrides[idx] = { ...overrides[idx], [overrideKey]: cloneEnterExit(value) };
        emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
        return;
    }
    emit('update-track', {
        ...props.motionTrack,
        block: { ...props.motionTrack.block, [which]: cloneEnterExit(value) },
    });
};

const updateEnterExits = (value: { enter?: MotionEnterExit; exit?: MotionEnterExit }) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedItemId.value) {
        const { overrides, idx } = getOrCreateOverride(selectedItemId.value);
        overrides[idx] = {
            ...overrides[idx],
            ...(value.enter ? { enterOverride: cloneEnterExit(value.enter) } : {}),
            ...(value.exit ? { exitOverride: cloneEnterExit(value.exit) } : {}),
        };
        emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
        return;
    }

    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            ...(value.enter ? { enter: cloneEnterExit(value.enter) } : {}),
            ...(value.exit ? { exit: cloneEnterExit(value.exit) } : {}),
        },
    });
};

const updateStyleGlobalOpacity = (value: number) => updateStyle('globalOpacity' as any, value);

const resetToDefaults = () => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    block.transform = {
        ...block.transform,
        offsetX: 0, offsetY: 0, scale: 1, rotation: 0,
    };
    emit('update-track', { ...props.motionTrack, block });
};

const setDefaultKeyframe = () => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    let propertyTracks = [...(block.propertyTracks || [])];
    const defaults: Record<string, number> = {
        'transform.offsetX': 0, 'transform.offsetY': 0,
        'transform.scale': 1, 'transform.rotation': 0,
    };
    for (const [path, value] of Object.entries(defaults)) {
        propertyTracks = autoKeyframe(path, value, propertyTracks);
    }
    block.transform = {
        ...block.transform,
        offsetX: 0, offsetY: 0, scale: 1, rotation: 0,
    };
    block.propertyTracks = propertyTracks;
    emit('update-track', { ...props.motionTrack, block });
};

const toggleKeyframe = (path: string, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    const propertyTracks = [...(block.propertyTracks || [])];
    const frame = currentFrame.value;
    let ptIdx = propertyTracks.findIndex((pt) => pt.propertyPath === path);

    if (ptIdx < 0) {
        const def = getPropertyDef(path);
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks.push({
            propertyPath: path,
            keyframes: [{ frame, value, interpolation: interp }],
            enabled: true,
        });
        emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
        return;
    }

    const pt = { ...propertyTracks[ptIdx] };

    if (pt.enabled === false) {
        pt.enabled = true;
        const def = getPropertyDef(path);
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks[ptIdx] = upsertKeyframe(pt as any, frame, value, interp) as any;
        emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
        return;
    }

    const sorted = [...(pt.keyframes || [])].sort((a, b) => a.frame - b.frame);
    const existingIdx = sorted.findIndex((kf) => kf.frame === frame);
    const def = getPropertyDef(path);
    const interp = def?.defaultInterpolation ?? 'linear';

    if (existingIdx >= 0) {
        propertyTracks[ptIdx] = removeKeyframeAtIndex(pt as any, existingIdx) as any;
    } else {
        propertyTracks[ptIdx] = upsertKeyframe(pt as any, frame, value, interp) as any;
    }
    emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
};

const togglePropertyKeyframing = (path: string) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    const propertyTracks = [...(block.propertyTracks || [])];
    const ptIdx = propertyTracks.findIndex((pt) => pt.propertyPath === path);

    if (ptIdx >= 0) {
        const pt = propertyTracks[ptIdx];
        const animVal = evalInterpolatedAtFrame(pt as any, currentFrame.value, undefined);
        if (animVal !== undefined) {
            const parts = path.split('.');
            const section = parts[0];
            const key = parts[1];
            if (section === 'style') {
                block.style = { ...block.style, [key]: animVal };
            } else if (section === 'transform') {
                block.transform = { ...block.transform, [key]: animVal };
            }
        }
        propertyTracks.splice(ptIdx, 1);
    } else {
        const def = getPropertyDef(path);
        const value = def?.getValue(props.motionTrack.block);
        const frame = currentFrame.value;
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks.push({
            propertyPath: path,
            keyframes: [{ frame, value, interpolation: interp }],
            enabled: true,
        });
    }
    emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
};

const getOrCreateOverride = (itemId: string) => {
    if (!props.motionTrack || isLocked.value) return { overrides: [] as ItemOverride[], idx: -1, override: null as ItemOverride | null };
    const overrides: ItemOverride[] = [...props.motionTrack.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === itemId);
    if (idx < 0) {
        overrides.push({ sourceItemId: itemId, hidden: false });
        idx = overrides.length - 1;
    }
    return { overrides, idx, override: overrides[idx] };
};

const updateItemStyleOverride = (itemId: string, key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack) return;
    const { overrides, idx } = getOrCreateOverride(itemId);
    overrides[idx] = { ...overrides[idx], styleOverride: { ...(overrides[idx].styleOverride || {}), [key]: value } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const updateItemTransformOverride = (itemId: string, key: keyof MotionTransform, value: any) => {
    if (!props.motionTrack) return;
    const { overrides, idx } = getOrCreateOverride(itemId);
    overrides[idx] = { ...overrides[idx], transformOverride: { ...(overrides[idx].transformOverride || {}), [key]: value } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const updateItemEnterExitOverride = (itemId: string, which: 'enter' | 'exit', key: keyof MotionEnterExit, value: any) => {
    if (!props.motionTrack) return;
    const overrideKey = which === 'enter' ? 'enterOverride' : 'exitOverride';
    const { overrides, idx } = getOrCreateOverride(itemId);
    overrides[idx] = { ...overrides[idx], [overrideKey]: { ...((overrides[idx] as any)[overrideKey] || {}), [key]: value } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const clearItemSelection = () => {
    selectedItemId.value = null;
    selectedWordIndex.value = null;
};

const onSelectItem = (itemId: string | null) => {
    selectedItemId.value = itemId;
    selectedWordIndex.value = null;
    if (itemId) {
        nextTick(() => {
            const inspectorScrollHost = inspectorRoot.value?.closest('.editor__inspector') as HTMLElement | null;
            inspectorScrollHost?.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
};

const onSelectWord = (idx: number) => {
    selectedWordIndex.value = selectedWordIndex.value === idx ? null : idx;
};

const updateWordStyle = (key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack || isLocked.value || !selectedItemId.value || selectedWordIndex.value === null) return;
    const overrides = [...props.motionTrack.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === selectedItemId.value);
    if (idx < 0) {
        overrides.push({ sourceItemId: selectedItemId.value, hidden: false });
        idx = overrides.length - 1;
    }
    const existing = overrides[idx].wordStyleMap || {};
    const wordEntry = { ...(existing[selectedWordIndex.value!] || {}), [key]: value };
    overrides[idx] = { ...overrides[idx], wordStyleMap: { ...existing, [selectedWordIndex.value!]: wordEntry } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const hasWordOverride = (wordIdx: number): boolean => {
    if (!selectedItemId.value || !props.motionTrack) return false;
    const o = props.motionTrack.block.overrides.find((x) => x.sourceItemId === selectedItemId.value);
    return !!(o?.wordStyleMap && o.wordStyleMap[wordIdx]);
};

const updateSelectedItemTextOverride = (text: string) => {
    if (!props.motionTrack || isLocked.value || !selectedItemId.value) return;
    const overrides = [...props.motionTrack.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === selectedItemId.value);
    if (idx < 0) {
        overrides.push({ sourceItemId: selectedItemId.value, hidden: false });
        idx = overrides.length - 1;
    }
    overrides[idx] = { ...overrides[idx], textOverride: text || undefined };
    if (!text && !overrides[idx].hidden && !overrides[idx].styleOverride && !overrides[idx].transformOverride && !overrides[idx].enterOverride && !overrides[idx].exitOverride && !overrides[idx].wordStyleMap) {
        overrides.splice(idx, 1);
    }
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const clearSelectedItemOverrides = () => {
    if (!props.motionTrack || isLocked.value || !selectedItemId.value) return;
    const overrides = props.motionTrack.block.overrides.filter((o) => o.sourceItemId !== selectedItemId.value);
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
    clearItemSelection();
};

const updateSelectedItemOverride = (updater: (current: ItemOverride) => ItemOverride) => {
    if (!props.motionTrack || isLocked.value || !selectedItemId.value) return;
    const overrides = [...props.motionTrack.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === selectedItemId.value);
    if (idx < 0) {
        overrides.push({ sourceItemId: selectedItemId.value, hidden: false });
        idx = overrides.length - 1;
    }
    overrides[idx] = updater(overrides[idx]);
    const next = overrides[idx];
    if (!next.hidden && !next.textOverride && !next.styleOverride && !next.transformOverride && !next.enterOverride && !next.exitOverride && !next.wordStyleMap) {
        overrides.splice(idx, 1);
    }
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const resetSelectedItemTextOverride = () => {
    updateSelectedItemOverride((current) => ({ ...current, textOverride: undefined }));
};

const resetSelectedItemStyleOverride = () => {
    updateSelectedItemOverride((current) => ({ ...current, styleOverride: undefined, wordStyleMap: undefined }));
};

const resetSelectedItemTransformOverride = () => {
    updateSelectedItemOverride((current) => ({ ...current, transformOverride: undefined }));
};

const resetSelectedItemAnimationOverride = () => {
    updateSelectedItemOverride((current) => ({ ...current, enterOverride: undefined, exitOverride: undefined }));
};
</script>

<template>
    <div ref="inspectorRoot" class="motion-inspector">
        <div v-if="!motionTrack" class="inspector-empty">
            Select a motion track to edit.
        </div>

        <template v-else>
            <div v-if="selectedItemId && editingItemLabel" class="motion-inspector__item-banner">
                <span class="motion-inspector__item-label">
                    Editing: <strong>{{ selectedWordIndex !== null ? selectedItemWords[selectedWordIndex] : editingItemLabel }}</strong>
                    <template v-if="selectedWordIndex !== null"> <span style="color:#666;">(word)</span></template>
                </span>
                <button class="btn-sm" @click="selectedWordIndex !== null ? (selectedWordIndex = null) : clearItemSelection()">
                    {{ selectedWordIndex !== null ? 'Back to item' : 'Back to block' }}
                </button>
            </div>
            <div v-if="selectedItemId && selectedItemWords.length > 1" class="motion-inspector__word-chips">
                <button
                    v-for="(word, wi) in selectedItemWords"
                    :key="wi"
                    class="word-chip"
                    :class="{ active: selectedWordIndex === wi, 'has-override': hasWordOverride(wi) }"
                    @click="onSelectWord(wi)"
                >{{ word }}</button>
            </div>

            <details
                v-if="selectedItemId && selectedWordIndex === null"
                class="inspector-section"
                :class="{ 'inspector-section--item-override': selectedItemTextHasOverride }"
                open
            >
                <summary class="inspector-section__title">Text</summary>
                <div class="inspector-section__content">
                    <div class="inspector-section__utility">
                        <button class="btn-sm" @click="resetSelectedItemTextOverride">Reset to block text</button>
                    </div>
                    <div class="inspector-field">
                        <label>Text Override</label>
                        <input
                            type="text"
                            class="inspector-input"
                            :value="selectedItemTextOverride"
                            :placeholder="selectedItem?.text ?? ''"
                            @input="updateSelectedItemTextOverride(($event.target as HTMLInputElement).value)"
                        />
                        <span class="inspector-hint">Empty = use source text.</span>
                    </div>
                    <div class="inspector-actions">
                        <button class="btn-sm" @click="selectedItem && emit('seek-to-ms', selectedItem.startMs)">Seek to item</button>
                        <button v-if="selectedItemOverride" class="btn-sm danger" @click="clearSelectedItemOverrides">Clear Item Overrides</button>
                    </div>
                </div>
            </details>

            <details v-if="!selectedItemId" class="inspector-section" >
                <summary class="inspector-section__title">Source &amp; Timing</summary>
                <div class="inspector-section__content">
                    <div class="inspector-field">
                        <label>Source Track</label>
                        <select class="inspector-input" :value="motionTrack.block.sourceTrackId" @change="updateSourceTrack(($event.target as HTMLSelectElement).value)">
                            <option v-for="track in lyricTracks" :key="track.id" :value="track.id">{{ track.name }}</option>
                        </select>
                        <span v-if="sourceMissing" class="inspector-hint" style="color:#e57373;">Source track missing.</span>
                    </div>
                    <AnimatableNumberField
                        class="motion-inspector__timing-field"
                        label="Start Frame"
                        :model-value="startFrame"
                        :min="0"
                        :step="1"
                        :fallback-value="0"
                        :hint="formatFrameAndMs(startFrame, motionTrack.block.startMs)"
                        :scrub-per-px="0.2"
                        @update:model-value="updateStartFrame"
                    />
                    <AnimatableNumberField
                        class="motion-inspector__timing-field"
                        label="End Frame"
                        :model-value="endFrame"
                        :min="0"
                        :step="1"
                        :fallback-value="0"
                        :hint="formatFrameAndMs(endFrame, motionTrack.block.endMs)"
                        :scrub-per-px="0.2"
                        @update:model-value="updateEndFrame"
                    />
                </div>
            </details>

            <details class="inspector-section">
                <summary class="inspector-section__title">Presets</summary>
                <div class="inspector-section__content">
                    <MotionPresetPanel
                        :motion-track="motionTrack"
                        :preset-adapter="subtitleMotionPresetAdapter"
                        :project-font="projectFont"
                        :disabled="!!selectedItemId || isLocked"
                        :disabled-message="blockPresetDisabledMessage"
                        @update-track="applyMotionPreset"
                    />
                </div>
            </details>

            <details class="inspector-section" :class="{ 'inspector-section--item-override': selectedItemStyleOverride }" >
                <summary class="inspector-section__title">Style</summary>
                <div class="inspector-section__content">
                    <div v-if="selectedItemId" class="inspector-section__utility">
                        <button class="btn-sm" @click="resetSelectedItemStyleOverride">Reset to block style</button>
                    </div>
                    <MotionAppearanceTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        :project-font="projectFont"
                        @update-style="updateStyle"
                        @update-font="updateFontSelection"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                    />
                </div>
            </details>

            <details class="inspector-section" :class="{ 'inspector-section--item-override': selectedItemTransformOverride }" >
                <summary class="inspector-section__title">Position</summary>
                <div class="inspector-section__content">
                    <div v-if="selectedItemId" class="inspector-section__utility">
                        <button class="btn-sm" @click="resetSelectedItemTransformOverride">Reset to block position</button>
                    </div>
                    <MotionPositionTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        :render-width="props.renderWidth"
                        :render-height="props.renderHeight"
                        @update-transform="updateTransform"
                        @update-anchor="updateAnchor"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                        @reset-to-defaults="resetToDefaults"
                        @set-default-keyframe="setDefaultKeyframe"
                    />
                </div>
            </details>

            <details class="inspector-section" :class="{ 'inspector-section--item-override': selectedItemStyleOverride }" >
                <summary class="inspector-section__title">Constraint Region</summary>
                <div class="inspector-section__content">
                    <MotionSafeAreaTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        @update-style="updateStyle"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                    />
                </div>
            </details>

            <details class="inspector-section" :class="{ 'inspector-section--item-override': selectedItemAnimationOverride }" >
                <summary class="inspector-section__title">Animation</summary>
                <div class="inspector-section__content">
                    <div v-if="selectedItemId" class="inspector-section__utility">
                        <button class="btn-sm" @click="resetSelectedItemAnimationOverride">Reset to block animation</button>
                    </div>
                    <MotionAnimationTab
                        :track="motionTrack"
                        :enter-value="selectedItemEnterValue"
                        :exit-value="selectedItemExitValue"
                        @update-enter-exit="updateEnterExit"
                        @update-enter-exits="updateEnterExits"
                    />
                </div>
            </details>

            <details class="inspector-section" >
                <summary class="inspector-section__title">Items</summary>
                <div class="inspector-section__content">
                    <MotionItemsTab
                        :track="motionTrack"
                        :lyric-tracks="lyricTracks"
                        :playhead-ms="playheadMs ?? 0"
                        :fps="fps ?? 60"
                        :selected-item-id="selectedItemId"
                        @update-track="$emit('update-track', $event)"
                        @seek-to-ms="$emit('seek-to-ms', $event)"
                        @select-item="onSelectItem"
                    />
                </div>
            </details>
        </template>
    </div>
</template>
