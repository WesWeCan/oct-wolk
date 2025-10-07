import { createMulberry32, deriveSeed, hashStringToUint32, type SceneContext, type SceneType, type WorkerScene } from './types';
import { createScene } from './SceneRegistry';

export interface EngineConfig {
    seed: string;
    resolution: { width: number; height: number };
    fontFamilyChain?: string;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    fontWeight?: number | 'normal' | 'bold' | 'bolder' | 'lighter';
    fps: number;
    analysis?: SceneContext['analysis'];
    sceneType: SceneType;
    params?: Record<string, any>;
}

export class SceneEngine {
    private target: OffscreenCanvasRenderingContext2D | null = null;
    private sceneA: WorkerScene | null = null;
    private sceneB: WorkerScene | null = null;
    private seedStr = 'seed';
    private seedBase = 1;
    private rng = createMulberry32(1);
    private width = 0;
    private height = 0;
    private fps = 60;
    private fontFamilyChain: string | undefined;
    private fontStyle: 'normal' | 'italic' | 'oblique' | undefined;
    private fontWeight: number | 'normal' | 'bold' | 'bolder' | 'lighter' | undefined;
    private analysis: SceneContext['analysis'] | undefined;
    private sceneTypeA: SceneType = 'wordcloud';
    private paramsA: Record<string, any> = {};
    private sceneTypeB: SceneType | null = null;
    private paramsB: Record<string, any> | null = null;

    attachTarget(ctx: OffscreenCanvasRenderingContext2D) {
        this.target = ctx;
    }

    configure(cfg: EngineConfig) {
        const nextSeedStr = String(cfg.seed || 'seed');
        const nextSeedBase = hashStringToUint32(nextSeedStr);
        const nextWidth = cfg.resolution.width | 0;
        const nextHeight = cfg.resolution.height | 0;
        const nextFps = Math.max(1, cfg.fps | 0);
        const nextFontFamilyChain = cfg.fontFamilyChain;
        const nextAnalysis = cfg.analysis;
        const nextSceneType = cfg.sceneType;
        const nextParams = cfg.params || {};

        const typeChanged = this.sceneTypeA !== nextSceneType;
        const sizeChanged = this.width !== nextWidth || this.height !== nextHeight;

        // Apply engine-wide state
        this.seedStr = nextSeedStr;
        this.seedBase = nextSeedBase;
        this.rng = createMulberry32(this.seedBase);
        this.width = nextWidth;
        this.height = nextHeight;
        this.fps = nextFps;
        this.fontFamilyChain = nextFontFamilyChain;
        this.fontStyle = cfg.fontStyle;
        this.fontWeight = cfg.fontWeight;
        this.analysis = nextAnalysis;
        this.sceneTypeA = nextSceneType;
        this.paramsA = nextParams;

        // If type or render size changed, recreate; otherwise hot-apply params
        if (!this.sceneA || !this.target || typeChanged || sizeChanged) {
            try { this.sceneA?.dispose(); } catch {}
            this.sceneA = createScene(this.sceneTypeA);
            this.sceneB = null;
            if (!this.sceneA || !this.target) return;
            this.sceneA.initialize(this.buildContext(0, 0, {}));
            this.sceneA.configure(this.paramsA);
            // Render immediately so UI reflects changes even when paused
            try { this.sceneA.render(this.target, this.buildContext(0, 0, {})); } catch {}
        } else {
            this.sceneA.configure(this.paramsA);
            // Render immediately so UI reflects changes even when paused
            try { this.sceneA.render(this.target, this.buildContext(0, 0, {})); } catch {}
        }
    }

    update(frame: number, dt: number, extras?: SceneContext['extras']) {
        if (this.sceneA) this.sceneA.update(frame, dt, this.buildContext(frame, dt, extras));
        if (this.sceneB) this.sceneB.update(frame, dt, this.buildContext(frame, dt, extras));
    }

    render(frame: number, dt: number, extras?: SceneContext['extras']) {
        if (!this.target) return;
        const ctx = this.target;
        if (this.sceneA) this.sceneA.render(ctx, this.buildContext(frame, dt, extras));
    }

    dispose() {
        try { this.sceneA?.dispose(); } catch {}
        try { this.sceneB?.dispose(); } catch {}
        this.sceneA = null;
        this.sceneB = null;
        this.target = null;
    }

    private buildContext(frame: number, dt: number, extras?: SceneContext['extras']): SceneContext {
        const base = this.seedBase;
        const createScopedRng = (key: string) => createMulberry32(deriveSeed(base, key));
        return {
            seedRng: this.rng,
            createScopedRng,
            resolution: { width: this.width, height: this.height },
            fontFamilyChain: this.fontFamilyChain,
            // style/weight can be added into extras if needed by scenes later
            analysis: this.analysis,
            time: { frame, fps: this.fps, dt },
            extras,
        };
    }

    configureMix(a: { type: SceneType; params: Record<string, any> }, b?: { type: SceneType; params: Record<string, any> }) {
        const nextTypeA = a.type;
        const nextParamsA = a.params || {};
        const nextTypeB = b ? b.type : null;
        const nextParamsB = b ? (b.params || {}) : null;

        // Handle scene A
        const aTypeChanged = this.sceneTypeA !== nextTypeA;
        this.sceneTypeA = nextTypeA;
        this.paramsA = nextParamsA;
        if (!this.sceneA || !this.target || aTypeChanged) {
            try { this.sceneA?.dispose(); } catch {}
            this.sceneA = createScene(this.sceneTypeA);
            if (this.sceneA && this.target) {
                this.sceneA.initialize(this.buildContext(0, 0, {}));
                this.sceneA.configure(this.paramsA);
                try { this.sceneA.render(this.target, this.buildContext(0, 0, {})); } catch {}
            }
        } else {
            this.sceneA.configure(this.paramsA);
            if (this.target) { try { this.sceneA.render(this.target, this.buildContext(0, 0, {})); } catch {} }
        }

        // Handle scene B (optional)
        const hadB = !!this.sceneTypeB;
        const willHaveB = !!nextTypeB;
        const bTypeChanged = this.sceneTypeB !== nextTypeB;
        this.sceneTypeB = nextTypeB;
        this.paramsB = nextParamsB;

        if (!willHaveB) {
            // Dispose existing B if it existed
            if (hadB) {
                try { this.sceneB?.dispose(); } catch {}
                this.sceneB = null;
            }
        } else {
            if (!this.sceneB || !this.target || bTypeChanged) {
                try { this.sceneB?.dispose(); } catch {}
                this.sceneB = createScene(this.sceneTypeB as SceneType);
                if (this.sceneB && this.target) {
                    this.sceneB.initialize(this.buildContext(0, 0, {}));
                    this.sceneB.configure(this.paramsB || {});
                    try { this.sceneB.render(this.target, this.buildContext(0, 0, {})); } catch {}
                }
            } else {
                this.sceneB.configure(this.paramsB || {});
                if (this.target) { try { this.sceneB.render(this.target, this.buildContext(0, 0, {})); } catch {} }
            }
        }
    }

    renderMix(frame: number, dt: number, extras: SceneContext['extras'] | undefined, alphaA: number, alphaB: number) {
        if (!this.target) return;
        const ctx = this.target;
        const prev = ctx.globalAlpha;
        if (this.sceneA && alphaA > 0) {
            ctx.globalAlpha = Math.min(1, Math.max(0, alphaA));
            this.sceneA.render(ctx, this.buildContext(frame, dt, extras));
        }
        if (this.sceneB && alphaB > 0) {
            ctx.globalAlpha = Math.min(1, Math.max(0, alphaB));
            this.sceneB.render(ctx, this.buildContext(frame, dt, extras));
        }
        ctx.globalAlpha = prev;
    }
}


