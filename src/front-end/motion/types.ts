import type {
    MotionBlock,
    MotionEnterExit,
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
    enter: MotionEnterExit;
    exit: MotionEnterExit;
    wordStyleMap?: Record<number, Partial<MotionStyle>>;
    forceStyleColor?: boolean;
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

export interface RendererBounds {
    x: number;
    y: number;
    width: number;
    height: number;
    referenceX: number;
    referenceY: number;
    localBoxX: number;
    localBoxY: number;
    localBoxWidth: number;
    localBoxHeight: number;
    rotation: number;
    scale: number;
}

export interface MotionBlockRenderer {
    prepare(block: MotionBlock): void;
    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void;
    getLastBounds?(): RendererBounds | null;
    dispose(): void;
}
