import { computed, reactive } from 'vue';
import { getPrimitive3DAnchorCapacity } from '@/front-end/motion-blocks/primitive3d/anchor-points';
import {
    cloneMotionEnterExit,
    createMotionVisualOffEnterExit,
    motionEnterExitEquals,
} from '@/front-end/utils/motion/motionEnterExitPresets';
import type { TextRevealParams } from '@/front-end/utils/motion/textReveal';
import type { MotionFontSelection } from '@/front-end/utils/fonts/fontUtils';
import { evalInterpolatedAtFrame, removeKeyframeAtIndex, upsertKeyframe } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import { getMotionBlockPropertyValue, setMotionBlockPropertyValue } from '@/front-end/utils/motion/blockPropertyPaths';
import {
    resolvePrimitive3DParams,
    type Primitive3DExitMode,
    type Primitive3DLightingMode,
    type Primitive3DMaterialRenderMode,
    type Primitive3DType,
    type Primitive3DWordPunctuationMode,
} from '@/front-end/motion-blocks/primitive3d/params';
import {
    createDefaultPrimitive3DEnter,
    createDefaultPrimitive3DExit,
} from '@/front-end/motion-blocks/primitive3d/defaults';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';
import type { LyricTrack, MotionStyle, MotionTrack, Scene3DSettings, WolkProjectFont } from '@/types/project_types';

export type Primitive3DInspectorProps = {
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    playheadMs?: number;
    fps?: number;
    projectFont?: WolkProjectFont;
    renderWidth?: number;
    renderHeight?: number;
    rendererBounds?: RendererBounds | null;
    scene3d?: Scene3DSettings;
};

type Primitive3DInspectorEmit = {
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
    (e: 'update-scene3d', value: Scene3DSettings): void;
};

export type Primitive3DInspectorApi = ReturnType<typeof usePrimitive3DInspector>;

export function usePrimitive3DInspector(props: Primitive3DInspectorProps, emit: Primitive3DInspectorEmit) {
    const fpsValue = computed(() => Math.max(1, props.fps ?? 60));
    const currentFrame = computed(() => Math.round(((props.playheadMs ?? 0) / 1000) * fpsValue.value));
    const isLocked = computed(() => !!props.motionTrack?.locked);
    const params = computed(() => resolvePrimitive3DParams(
        props.motionTrack?.block.params,
        props.motionTrack?.block.enter,
        props.motionTrack?.block.exit,
    ));
    const scene3d = computed(() => normalizeScene3DSettings(props.scene3d));
    const style = computed(() => props.motionTrack?.block.style || null);
    const wordTracks = computed(() => props.lyricTracks.filter((track) => track.kind === 'word'));
    const selectedWordTrack = computed(() => wordTracks.value.find((track) => track.id === props.motionTrack?.block.sourceTrackId) ?? null);
    const anchorCapacity = computed(() => getPrimitive3DAnchorCapacity(params.value));

    const startFrame = computed(() => {
        if (!props.motionTrack) return 0;
        return Math.round((props.motionTrack.block.startMs / 1000) * fpsValue.value);
    });

    const endFrame = computed(() => {
        if (!props.motionTrack) return 0;
        return Math.round((props.motionTrack.block.endMs / 1000) * fpsValue.value);
    });

    const formatFrameAndMs = (frame: number, ms: number): string => {
        return `Frame ${Math.max(0, Math.round(frame))} (${Math.max(0, Math.round(ms))} ms)`;
    };

    const getPropertyTrack = (path: string) => {
        return props.motionTrack?.block.propertyTracks.find((track) => track.propertyPath === path) ?? null;
    };

    const hasKeyframing = (path: string) => !!getPropertyTrack(path);
    const hasAnyKeyframes = (path: string) => !!getPropertyTrack(path)?.keyframes?.length;
    const hasKeyAtCurrentFrame = (path: string) => !!getPropertyTrack(path)?.keyframes?.some((keyframe) => keyframe.frame === currentFrame.value);

    const valueForPath = (path: string) => {
        if (!props.motionTrack) return 0;
        const propertyTrack = getPropertyTrack(path);
        if (propertyTrack && propertyTrack.enabled !== false && propertyTrack.keyframes?.length) {
            const fallback = getMotionBlockPropertyValue(props.motionTrack.block, path);
            return evalInterpolatedAtFrame(propertyTrack as any, currentFrame.value, fallback);
        }
        return getMotionBlockPropertyValue(props.motionTrack.block, path);
    };

    const emitUpdatedBlock = (nextBlock: MotionTrack['block']) => {
        if (!props.motionTrack) return;
        emit('update-track', { ...props.motionTrack, block: nextBlock });
    };

    const autoKeyframe = (path: string, value: any, propertyTracks: any[]): any[] => {
        const propertyTrackIndex = propertyTracks.findIndex((track: any) => track.propertyPath === path);
        if (propertyTrackIndex < 0) return propertyTracks;
        if (propertyTracks[propertyTrackIndex].enabled === false) return propertyTracks;
        if (!propertyTracks[propertyTrackIndex].keyframes?.length) return propertyTracks;
        const definition = getPropertyDef(path);
        const interpolation = definition?.defaultInterpolation ?? 'linear';
        const nextTracks = [...propertyTracks];
        nextTracks[propertyTrackIndex] = upsertKeyframe(nextTracks[propertyTrackIndex] as any, currentFrame.value, value, interpolation) as any;
        return nextTracks;
    };

    const updateStartFrame = (frame: number) => {
        if (!props.motionTrack || isLocked.value) return;
        const startMs = Math.max(0, Math.round((frame / fpsValue.value) * 1000));
        const endMs = Math.max(startMs + 100, props.motionTrack.block.endMs);
        emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, startMs, endMs } });
    };

    const updateEndFrame = (frame: number) => {
        if (!props.motionTrack || isLocked.value) return;
        const endMs = Math.round((frame / fpsValue.value) * 1000);
        const minEnd = props.motionTrack.block.startMs + 100;
        emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, endMs: Math.max(minEnd, endMs) } });
    };

    const updatePathValue = (path: string, value: any) => {
        if (!props.motionTrack || isLocked.value) return;
        const block = setMotionBlockPropertyValue(props.motionTrack.block, path, value);
        block.propertyTracks = autoKeyframe(path, value, [...(block.propertyTracks || [])]);
        emitUpdatedBlock(block);
    };

    const updateStyle = (key: keyof MotionStyle, value: any) => {
        if (!props.motionTrack || isLocked.value) return;
        const block = {
            ...props.motionTrack.block,
            style: {
                ...props.motionTrack.block.style,
                [key]: value,
            },
        };
        emitUpdatedBlock(block);
    };

    const updateFontSelection = (selection: MotionFontSelection) => {
        updateStyle('fontFamily', selection.family);
        updateStyle('fontFallbacks', selection.fallbacks);
        updateStyle('fontStyle', selection.style);
        updateStyle('fontWeight', selection.weight);
        updateStyle('fontName', selection.name);
        updateStyle('fontLocalPath', selection.localPath);
    };

    const updateSourceTrackId = (trackId: string) => {
        if (!props.motionTrack || isLocked.value) return;
        emit('update-track', {
            ...props.motionTrack,
            block: {
                ...props.motionTrack.block,
                sourceTrackId: trackId,
            },
        });
    };

    const updateEnterExit = (which: 'enter' | 'exit', value: MotionTrack['block']['enter']) => {
        if (!props.motionTrack || isLocked.value) return;
        emitUpdatedBlock({
            ...props.motionTrack.block,
            [which]: cloneMotionEnterExit(value),
        });
    };

    const blockMotionStillAtDefaults = (): boolean => {
        if (!props.motionTrack) return false;
        return motionEnterExitEquals(props.motionTrack.block.enter, createDefaultPrimitive3DEnter())
            && motionEnterExitEquals(props.motionTrack.block.exit, createDefaultPrimitive3DExit());
    };

    const updateTextReveal = (value: TextRevealParams) => {
        if (!props.motionTrack || isLocked.value) return;
        const shouldAutoApplyMotionOff = params.value.textReveal.textRevealMode !== 'typewriter'
            && value.textRevealMode === 'typewriter'
            && blockMotionStillAtDefaults();
        const nextEnter = shouldAutoApplyMotionOff
            ? createMotionVisualOffEnterExit(props.motionTrack.block.enter)
            : props.motionTrack.block.enter;
        const nextExit = shouldAutoApplyMotionOff
            ? createMotionVisualOffEnterExit(props.motionTrack.block.exit)
            : props.motionTrack.block.exit;
        emitUpdatedBlock({
            ...props.motionTrack.block,
            enter: nextEnter,
            exit: nextExit,
            params: resolvePrimitive3DParams({
                ...props.motionTrack.block.params,
                textReveal: value,
            }, nextEnter, nextExit) as any,
        });
    };

    const updateLifecycleExitMode = (value: Primitive3DExitMode) => {
        if (!props.motionTrack || isLocked.value) return;
        emitUpdatedBlock({
            ...props.motionTrack.block,
            params: resolvePrimitive3DParams({
                ...props.motionTrack.block.params,
                lifecycle: {
                    ...params.value.lifecycle,
                    exitMode: value,
                },
            }, props.motionTrack.block.enter, props.motionTrack.block.exit) as any,
        });
    };

    const updateLifecycleExitDelayMs = (value: number) => {
        if (!props.motionTrack || isLocked.value) return;
        emitUpdatedBlock({
            ...props.motionTrack.block,
            params: resolvePrimitive3DParams({
                ...props.motionTrack.block.params,
                lifecycle: {
                    ...params.value.lifecycle,
                    exitDelayMs: Math.max(0, value),
                },
            }, props.motionTrack.block.enter, props.motionTrack.block.exit) as any,
        });
    };

    const toggleKeyframe = (path: string, value: any) => {
        if (!props.motionTrack || isLocked.value) return;
        const block = { ...props.motionTrack.block, propertyTracks: [...(props.motionTrack.block.propertyTracks || [])] };
        const propertyTrackIndex = block.propertyTracks.findIndex((track) => track.propertyPath === path);
        const definition = getPropertyDef(path);
        const interpolation = definition?.defaultInterpolation ?? 'linear';

        if (propertyTrackIndex < 0) {
            block.propertyTracks.push({
                propertyPath: path,
                enabled: true,
                keyframes: [{ frame: currentFrame.value, value, interpolation }],
            });
            emitUpdatedBlock(block);
            return;
        }

        const propertyTrack = { ...block.propertyTracks[propertyTrackIndex] };
        const existingIndex = propertyTrack.keyframes.findIndex((keyframe) => keyframe.frame === currentFrame.value);
        if (existingIndex >= 0) {
            propertyTrack.keyframes = removeKeyframeAtIndex(propertyTrack as any, existingIndex).keyframes;
            block.propertyTracks[propertyTrackIndex] = propertyTrack;
        } else {
            block.propertyTracks[propertyTrackIndex] = upsertKeyframe(propertyTrack as any, currentFrame.value, value, interpolation) as any;
        }

        emitUpdatedBlock(block);
    };

    const togglePropertyKeyframing = (path: string) => {
        if (!props.motionTrack || isLocked.value) return;
        const block = { ...props.motionTrack.block, propertyTracks: [...(props.motionTrack.block.propertyTracks || [])] };
        const propertyTrackIndex = block.propertyTracks.findIndex((track) => track.propertyPath === path);

        if (propertyTrackIndex >= 0) {
            block.propertyTracks.splice(propertyTrackIndex, 1);
            emitUpdatedBlock(block);
            return;
        }

        const value = getMotionBlockPropertyValue(block, path);
        block.propertyTracks.push({
            propertyPath: path,
            enabled: true,
            keyframes: [{ frame: currentFrame.value, value, interpolation: getPropertyDef(path)?.defaultInterpolation ?? 'linear' }],
        });
        emitUpdatedBlock(block);
    };

    const updatePrimitiveType = (type: Primitive3DType) => updatePathValue('params.primitive.type', type);
    const updateLightingMode = (mode: Primitive3DLightingMode) => updatePathValue('params.lighting.mode', mode);
    const updateRenderMode = (mode: Primitive3DMaterialRenderMode) => updatePathValue('params.material.renderMode', mode);
    const updatePunctuationMode = (mode: Primitive3DWordPunctuationMode) => updatePathValue('params.words.punctuationMode', mode);
    const updateScene3D = (value: Scene3DSettings) => emit('update-scene3d', value);

    const projectFont = computed(() => props.projectFont);
    const rendererBounds = computed(() => props.rendererBounds ?? null);

    return reactive({
        fpsValue,
        currentFrame,
        isLocked,
        params,
        scene3d,
        style,
        wordTracks,
        selectedWordTrack,
        anchorCapacity,
        startFrame,
        endFrame,
        projectFont,
        rendererBounds,
        formatFrameAndMs,
        hasKeyframing,
        hasAnyKeyframes,
        hasKeyAtCurrentFrame,
        valueForPath,
        updateStartFrame,
        updateEndFrame,
        updatePathValue,
        updateStyle,
        updateFontSelection,
        updateSourceTrackId,
        updateEnterExit,
        updateTextReveal,
        updateLifecycleExitMode,
        updateLifecycleExitDelayMs,
        toggleKeyframe,
        togglePropertyKeyframing,
        updatePrimitiveType,
        updateLightingMode,
        updateRenderMode,
        updatePunctuationMode,
        updateScene3D,
    });
}
