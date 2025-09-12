// Basic render worker skeleton for OffscreenCanvas-based rendering

export interface RenderInitMessage {
    type: 'init';
    canvas: OffscreenCanvas;
    width: number;
    height: number;
}

export interface RenderFrameMessage {
    type: 'frame';
    frame: number;
    dt: number;
    beat?: number; // 0..1 energy/envelope to drive pulsing
    globalAlpha?: number; // 0..1 project-wide opacity
    wordIndex?: number; // precomputed word index for deterministic scenes
    alphaA?: number; // 0..1 mix alpha for scene A
    alphaB?: number; // 0..1 mix alpha for scene B
    wordOverride?: string;
}

export interface RenderDisposeMessage {
    type: 'dispose';
}

export interface RenderConfigureMessage {
    type: 'configure';
    seed: string;
    words: string[];
    sceneType: 'wordcloud' | 'singleWord';
    fontFamilyChain?: string;
    fps?: number;
}

export interface RenderConfigureMixMessage {
    type: 'configureMix';
    seed: string;
    a: { sceneType: 'wordcloud' | 'singleWord'; params: Record<string, any> };
    b?: { sceneType: 'wordcloud' | 'singleWord'; params: Record<string, any> };
    fontFamilyChain?: string;
    fps?: number;
}

type WorkerMessage = RenderInitMessage | RenderFrameMessage | RenderDisposeMessage | RenderConfigureMessage | RenderConfigureMixMessage;

let ctx2d: OffscreenCanvasRenderingContext2D | null = null;
let canvasRef: OffscreenCanvas | null = null;
let configured = false;
let sceneType: 'wordcloud' | 'singleWord' = 'wordcloud';
let words: string[] = [];
let canvasWidth = 0;
let canvasHeight = 0;
let fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
let fps = 60;

// Engine
import { SceneEngine } from './engine/SceneEngine';
import { registerScene } from './engine/SceneRegistry';
import type { SceneType } from './engine/types';
import { WordCloudScene } from './scenes/WordCloudScene';
import { SingleWordScene } from './scenes/SingleWordScene';

// register scenes
registerScene('wordcloud', () => new WordCloudScene());
registerScene('singleWord', () => new SingleWordScene());

const engine = new SceneEngine();

// Simple seeded PRNG (Mulberry32)
const mulberry32 = (a: number) => {
    return () => {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

let rng = mulberry32(1);

// remove old ad-hoc layout cache

const handleInit = (msg: RenderInitMessage) => {
    canvasRef = msg.canvas;
    ctx2d = msg.canvas.getContext('2d');
    if (ctx2d) {
        ctx2d.canvas.width = msg.width;
        ctx2d.canvas.height = msg.height;
        canvasWidth = msg.width;
        canvasHeight = msg.height;
        ctx2d.fillStyle = '#111';
        ctx2d.fillRect(0, 0, msg.width, msg.height);
        ctx2d.fillStyle = '#0f0';
        ctx2d.font = '20px sans-serif';
        ctx2d.fillText('Render worker initialized', 20, 40);
    }
};

const handleFrame = (msg: RenderFrameMessage) => {
    if (!ctx2d) return;
    const { frame } = msg;
    const { width, height } = ctx2d.canvas as OffscreenCanvas;
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = '#111';
    ctx2d.fillRect(0, 0, width, height);
    if (!configured) {
        ctx2d.fillStyle = '#0f0';
        ctx2d.font = '20px sans-serif';
        ctx2d.fillText('Render worker initialized', 20, 40);
        try { (self as any).postMessage({ type: 'rendered', frame }); } catch {}
        return;
    }
    const beat = typeof msg.beat === 'number' ? Math.max(0, Math.min(1, msg.beat)) : 0;
    const prevAlpha = ctx2d.globalAlpha;
    if (typeof msg.globalAlpha === 'number') {
        ctx2d.globalAlpha = Math.min(1, Math.max(0, msg.globalAlpha));
    }
    engine.update(frame, msg.dt, { beat, wordIndex: msg.wordIndex, globalAlpha: msg.globalAlpha, wordOverride: (msg as any).wordOverride });
    const aA = typeof msg.alphaA === 'number' ? Math.min(1, Math.max(0, msg.alphaA)) : 1;
    const aB = typeof msg.alphaB === 'number' ? Math.min(1, Math.max(0, msg.alphaB)) : 0;
    engine.renderMix(frame, msg.dt, { beat, wordIndex: msg.wordIndex, globalAlpha: msg.globalAlpha, wordOverride: (msg as any).wordOverride }, aA, aB);
    ctx2d.globalAlpha = prevAlpha;
    try { (self as any).postMessage({ type: 'rendered', frame }); } catch {}
};

const handleDispose = () => {
    engine.dispose();
    ctx2d = null;
    canvasRef = null;
    configured = false;
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    switch (msg.type) {
        case 'init':
            handleInit(msg);
            break;
        case 'frame':
            handleFrame(msg);
            break;
        case 'configure':
            configured = true;
            words = Array.isArray(msg.words) ? msg.words.slice(0, 500) : [];
            sceneType = msg.sceneType as any;
            fontFamilyChain = String(msg.fontFamilyChain || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
            fps = Math.max(1, (msg.fps as any) | 0) || 60;
            if (ctx2d) {
                engine.attachTarget(ctx2d);
                engine.configure({
                    seed: String(msg.seed || 'seed'),
                    resolution: { width: canvasWidth, height: canvasHeight },
                    fontFamilyChain,
                    fps,
                    sceneType: sceneType as any,
                    params: { words, fontFamilyChain },
                });
            }
            break;
        case 'configureMix':
            configured = true;
            fontFamilyChain = String((msg as any).fontFamilyChain || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
            fps = Math.max(1, ((msg as any).fps as any) | 0) || 60;
            if (ctx2d) {
                engine.attachTarget(ctx2d);
                engine.configure({
                    seed: String((msg as any).seed || 'seed'),
                    resolution: { width: canvasWidth, height: canvasHeight },
                    fontFamilyChain,
                    fps,
                    sceneType: (msg as any).a.sceneType,
                    params: (msg as any).a.params,
                });
                engine.configureMix({ type: (msg as any).a.sceneType, params: (msg as any).a.params }, (msg as any).b ? { type: (msg as any).b.sceneType, params: (msg as any).b.params } : undefined);
            }
            break;
        case 'dispose':
            handleDispose();
            break;
    }
};


