import {
    createMulberry32,
    deriveSeed,
    hashStringToUint32,
    type SeedRng,
} from '@/front-end/utils/seededRng';

export { createMulberry32, deriveSeed, hashStringToUint32, type SeedRng };

export interface AnalysisContext {
    energyPerFrame?: number[];
    isOnsetPerFrame?: boolean[];
    bpm?: number;
    beatTimes?: number[];
}

export interface TimeContext {
    frame: number;
    fps: number;
    dt: number;
}

export interface SceneContext {
    seedRng: SeedRng;
    createScopedRng: (key: string) => SeedRng;
    resolution: { width: number; height: number };
    fontFamilyChain?: string;
    analysis?: AnalysisContext;
    time: TimeContext;
    extras?: { wordIndex?: number; beat?: number; globalAlpha?: number; wordOverride?: string; lowBand?: number; midBand?: number; highBand?: number; animated?: Record<string, any> };
}

export interface WorkerScene {
    initialize(context: SceneContext): void | Promise<void>;
    configure(params: Record<string, any>): void;
    update(frame: number, dt: number, context: SceneContext): void;
    render(target: OffscreenCanvasRenderingContext2D, context: SceneContext): void;
    dispose(): void;
    serialize(): any;
    deserialize(data: any): void;
}

export type SceneType = 'wordcloud' | 'singleWord' | 'wordSphere' | 'model3d' | 'portraitMask';

export type SceneFactory = (args: { type: SceneType }) => WorkerScene;


