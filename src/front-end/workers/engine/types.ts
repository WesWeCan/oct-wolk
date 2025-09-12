export type SeedRng = () => number;

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
    extras?: { wordIndex?: number; beat?: number; globalAlpha?: number; wordOverride?: string };
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

export type SceneType = 'wordcloud' | 'singleWord';

export type SceneFactory = (args: { type: SceneType }) => WorkerScene;

export function hashStringToUint32(seed: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

export function createMulberry32(a: number): SeedRng {
    return () => {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function deriveSeed(base: number, key: string): number {
    let h = base >>> 0;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 2246822519);
        h ^= h >>> 13;
    }
    return h >>> 0;
}


