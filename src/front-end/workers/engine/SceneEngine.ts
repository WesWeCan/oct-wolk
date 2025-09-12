import { createMulberry32, deriveSeed, hashStringToUint32, type SceneContext, type SceneType, type WorkerScene } from './types';
import { createScene } from './SceneRegistry';

export interface EngineConfig {
    seed: string;
    resolution: { width: number; height: number };
    fontFamilyChain?: string;
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
    private analysis: SceneContext['analysis'] | undefined;
    private sceneTypeA: SceneType = 'wordcloud';
    private paramsA: Record<string, any> = {};
    private sceneTypeB: SceneType | null = null;
    private paramsB: Record<string, any> | null = null;

    attachTarget(ctx: OffscreenCanvasRenderingContext2D) {
        this.target = ctx;
    }

    configure(cfg: EngineConfig) {
        this.seedStr = String(cfg.seed || 'seed');
        this.seedBase = hashStringToUint32(this.seedStr);
        this.rng = createMulberry32(this.seedBase);
        this.width = cfg.resolution.width | 0;
        this.height = cfg.resolution.height | 0;
        this.fps = Math.max(1, cfg.fps | 0);
        this.fontFamilyChain = cfg.fontFamilyChain;
        this.analysis = cfg.analysis;
        this.sceneTypeA = cfg.sceneType;
        this.paramsA = cfg.params || {};

        // Recreate scenes
        try { this.sceneA?.dispose(); } catch {}
        this.sceneA = createScene(this.sceneTypeA);
        this.sceneB = null;
        if (!this.sceneA || !this.target) return;
        this.sceneA.initialize(this.buildContext(0, 0, {}));
        this.sceneA.configure(this.paramsA);
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
            analysis: this.analysis,
            time: { frame, fps: this.fps, dt },
            extras,
        };
    }

    configureMix(a: { type: SceneType; params: Record<string, any> }, b?: { type: SceneType; params: Record<string, any> }) {
        this.sceneTypeA = a.type;
        this.paramsA = a.params || {};
        this.sceneTypeB = b ? b.type : null;
        this.paramsB = b ? (b.params || {}) : null;
        try { this.sceneA?.dispose(); } catch {}
        try { this.sceneB?.dispose(); } catch {}
        this.sceneA = createScene(this.sceneTypeA);
        this.sceneB = this.sceneTypeB ? createScene(this.sceneTypeB as SceneType) : null;
        if (this.sceneA && this.target) {
            this.sceneA.initialize(this.buildContext(0, 0, {}));
            this.sceneA.configure(this.paramsA);
        }
        if (this.sceneB && this.target) {
            this.sceneB.initialize(this.buildContext(0, 0, {}));
            this.sceneB.configure(this.paramsB || {});
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


