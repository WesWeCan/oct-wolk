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
}

export interface RenderDisposeMessage {
    type: 'dispose';
}

export interface RenderConfigureMessage {
    type: 'configure';
    seed: string;
    words: string[];
    sceneType: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord';
    fontFamilyChain?: string;
}

type WorkerMessage = RenderInitMessage | RenderFrameMessage | RenderDisposeMessage | RenderConfigureMessage;

let ctx2d: OffscreenCanvasRenderingContext2D | null = null;
let canvasRef: OffscreenCanvas | null = null;
let configured = false;
let sceneType: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord' = 'wordcloud';
let words: string[] = [];
let canvasWidth = 0;
let canvasHeight = 0;
let fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

// Scene dispatch
import { WordCloudScene } from './scenes/WordCloudScene';
import { SingleWordScene } from './scenes/SingleWordScene';
type SceneInstance = { render: (frame: number, beat: number, extras?: { wordIndex?: number }) => void; configure: (cfg: any) => void } | null;
let sceneInstance: SceneInstance = null;

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

// Cached layout for wordcloud
type WordLayout = { text: string; x: number; y: number; size: number; hue: number };
let layout: WordLayout[] = [];

const computeWordCloudLayout = (width: number, height: number) => {
    layout = [];
    if (!ctx2d) return;
    const area = width * height;
    const baseSize = Math.max(12, Math.sqrt(area / 1500));
    const maxWords = Math.min(words.length, 200);
    const cx = width / 2;
    const cy = height / 2;
    const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle ~2.399
    const radiusStep = Math.max(8, Math.min(width, height) * 0.008);
    for (let i = 0; i < maxWords; i++) {
        const text = words[i];
        const size = baseSize * (0.7 + rng() * 0.6);
        const r = i * radiusStep;
        const a = i * golden;
        const jitter = 4;
        const x = cx + Math.cos(a) * r + (rng() - 0.5) * jitter;
        const y = cy + Math.sin(a) * r + (rng() - 0.5) * jitter;
        const hue = Math.floor(rng() * 360);
        layout.push({ text, x, y, size, hue });
    }
};

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
    if (sceneInstance) {
        const prevAlpha = ctx2d.globalAlpha;
        if (typeof msg.globalAlpha === 'number') {
            ctx2d.globalAlpha = Math.min(1, Math.max(0, msg.globalAlpha));
        }
        sceneInstance.render(frame, beat, { wordIndex: msg.wordIndex });
        ctx2d.globalAlpha = prevAlpha;
    } else {
        ctx2d.fillStyle = '#0ff';
        ctx2d.font = '24px sans-serif';
        ctx2d.fillText(`Frame ${frame}`, 20, 40);
    }
    try { (self as any).postMessage({ type: 'rendered', frame }); } catch {}
};

const handleDispose = () => {
    ctx2d = null;
    canvasRef = null;
    configured = false;
    layout = [];
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
            sceneType = msg.sceneType;
            fontFamilyChain = String(msg.fontFamilyChain || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
            // Seed RNG
            let seedInt = 1;
            try {
                seedInt = Array.from(msg.seed || 'seed').reduce((a: number, c: string) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0) >>> 0;
            } catch {}
            rng = mulberry32(seedInt);
            // Create scene instance
            sceneInstance = null;
            if (ctx2d) {
                if (sceneType === 'wordcloud') {
                    const sc = new WordCloudScene(ctx2d, String(msg.seed || 'seed'));
                    sc.configure({ seed: String(msg.seed || 'seed'), words, width: canvasWidth, height: canvasHeight, fontFamilyChain });
                    sceneInstance = sc as SceneInstance;
                } else if (sceneType === 'singleWord') {
                    const sc = new SingleWordScene(ctx2d, String(msg.seed || 'seed'));
                    sc.configure({ seed: String(msg.seed || 'seed'), words, width: canvasWidth, height: canvasHeight, fontFamilyChain });
                    sceneInstance = sc as SceneInstance;
                }
            }
            break;
        case 'dispose':
            handleDispose();
            break;
    }
};


