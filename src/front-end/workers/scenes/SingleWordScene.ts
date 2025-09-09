export interface SingleWordConfig {
    seed: string;
    words: string[];
    width: number;
    height: number;
    fontFamilyChain?: string;
}

export class SingleWordScene {
    private ctx: OffscreenCanvasRenderingContext2D;
    private rng: () => number;
    private words: string[] = [];
    private width = 0;
    private height = 0;
    private currentIndex = 0;
    private lastBeat = 0;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    constructor(ctx: OffscreenCanvasRenderingContext2D, seed: string) {
        this.ctx = ctx;
        this.rng = this.mulberry32(this.hashSeed(seed));
    }

    configure(config: SingleWordConfig) {
        const words = config.words.length ? config.words : ['wolk'];
        this.words = words.map(w => w.toUpperCase());
        this.width = config.width;
        this.height = config.height;
        this.currentIndex = Math.floor(this.rng() * this.words.length);
        this.lastBeat = 0;
        this.fontFamilyChain = config.fontFamilyChain || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    }

    render(frame: number, beat: number, extras?: { wordIndex?: number }) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        // Prefer host-provided deterministic index if available (precomputed by frame)
        const wordsLen = Math.max(1, this.words.length);
        if (extras && typeof extras.wordIndex === 'number' && isFinite(extras.wordIndex)) {
            this.currentIndex = ((extras.wordIndex % wordsLen) + wordsLen) % wordsLen;
        } else {
            // fallback: advance on beat crossings deterministically
            const threshold = 0.07;
            if (beat > threshold && this.lastBeat <= threshold) {
                this.currentIndex = (this.currentIndex + 1) % this.words.length;
            }
            this.lastBeat = beat;
        }


        const text = this.words[this.currentIndex];
        const base = Math.min(w, h) * 0.2;
        const size = base * (0.8 + 0.4 * beat);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${size}px ${this.fontFamilyChain}`;
        ctx.fillStyle = '#fff';
        ctx.fillText(text, w / 2, h / 2);
    }

    private hashSeed(seed: string): number {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    private mulberry32(a: number) {
        return () => {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
}


