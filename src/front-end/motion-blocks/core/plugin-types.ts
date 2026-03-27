import type { Component } from 'vue';
import type { FontDescriptor } from '@/front-end/utils/fonts/fontUtils';
import type { KeyframePropertyDef } from '@/front-end/motion-blocks/core/keyframes';
import type { MotionBlockRenderer, RendererBounds, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import type { LyricTrack, MotionBlock, MotionTrack, WolkProject, WolkProjectFont } from '@/types/project_types';
import type { MotionPresetDocument } from '@/types/motion_preset_types';

export interface MotionBlockMeta {
    label: string;
    description?: string;
    authorable?: boolean;
    order?: number;
    requiresSourceTrack?: boolean;
    /** When true, this track still renders while another track is soloed (muted/disabled still hide it). */
    ignoreSolo?: boolean;
    renderSpace?: '2d' | '3d';
    supportsMonitorGizmo?: boolean;
}

export interface CreateMotionTrackArgs {
    project: WolkProject;
    sourceTrack?: LyricTrack | null;
    startMs: number;
    endMs: number;
    color: string;
    trackId: string;
    blockId: string;
}

export interface NormalizeMotionTrackArgs {
    project?: WolkProject;
    projectFont?: WolkProjectFont;
}

export interface MotionBlockPresetAdapter<TPayload = unknown, TDocument extends MotionPresetDocument<TPayload> = MotionPresetDocument<TPayload>> {
    version: number;
    extractPayload(track: MotionTrack, args: NormalizeMotionTrackArgs): TPayload;
    applyPreset(track: MotionTrack, document: TDocument, args: NormalizeMotionTrackArgs): MotionTrack;
}

export interface MotionBlockPlugin {
    type: string;
    meta: MotionBlockMeta;
    inspectorComponent?: Component;
    createTrack(args: CreateMotionTrackArgs): MotionTrack;
    normalizeTrack(track: MotionTrack, args: NormalizeMotionTrackArgs): MotionTrack;
    createRenderer(): MotionBlockRenderer;
    resolveActiveItems(
        block: MotionBlock,
        sourceTrack: LyricTrack | null | undefined,
        currentFrame: number,
        fps: number,
    ): ResolvedItem[];
    resolveBlockItems(
        block: MotionBlock,
        sourceTrack: LyricTrack | null | undefined,
        currentFrame: number,
        fps: number,
    ): ResolvedItem[];
    cleanOrphanedOverrides?(project: WolkProject): { removedCount: number };
    collectFonts?(project: WolkProject, track: MotionTrack): FontDescriptor[];
    getKeyframeProperties?(): KeyframePropertyDef[];
    presets?: MotionBlockPresetAdapter<any>;
    gizmo?: {
        // Reuse the shared useMotionGizmo pipeline for new blocks instead of cloning subtitle monitor logic.
        // Block-specific math belongs in these hooks plus renderer.getLastBounds(), not in a second gizmo implementation.
        getFallbackBounds?(
            track: MotionTrack,
            renderWidth: number,
            renderHeight: number,
        ): RendererBounds | null;
        applyDelta?(
            track: MotionTrack,
            mode: 'move' | 'scale' | 'rotate',
            dx: number,
            dy: number,
            context: {
                renderWidth: number;
                renderHeight: number;
                currentBounds: RendererBounds | null;
                currentFrame: number;
            },
        ): {
            track: MotionTrack;
            autoKeyframePaths?: string[];
        };
        supportsSafeAreaGuide?: boolean;
    };
}
