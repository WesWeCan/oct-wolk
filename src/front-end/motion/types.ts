import type {
    MotionBlock,
    MotionStyle,
    MotionTrack,
    MotionTransform,
    WolkProject,
} from '@/types/project_types';

export interface ResolvedItem {
    id: string;
    text: string;
    richText?: any;
    startMs: number;
    endMs: number;
    enterProgress: number;
    exitProgress: number;
    isActive: boolean;
    style: MotionStyle;
    transform: MotionTransform;
}

export interface MotionRenderContext {
    project: WolkProject;
    track: MotionTrack;
    block: MotionBlock;
    currentFrame: number;
    fps: number;
    canvasSize: { width: number; height: number };
    allItems: ResolvedItem[];
}

export interface MotionBlockRenderer {
    prepare(block: MotionBlock): void;
    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void;
    dispose(): void;
}
