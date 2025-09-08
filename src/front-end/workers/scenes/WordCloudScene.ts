export interface SceneConfig {
    seed: string;
    words: string[];
    width: number;
    height: number;
}

export class WordCloudScene {
    private ctx: OffscreenCanvasRenderingContext2D;
    private rng: () => number;
    private layout: { text: string; x: number; y: number; size: number; hue: number; w: number; h: number }[] = [];
    private configured = false;

    constructor(ctx: OffscreenCanvasRenderingContext2D, seed: string) {
        this.ctx = ctx;
        this.rng = this.mulberry32(this.hashSeed(seed));
    }

    configure(config: SceneConfig) {
        this.layout = this.computeLayout(config);
        this.configured = true;
    }

    render(frame: number, beat: number) {
        if (!this.configured) return;
        const t = frame / 60;
        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const w of this.layout) {
            const pulse = 0.9 + 0.3 * beat;
            const size = w.size * pulse;
            ctx.font = `${size}px sans-serif`;
            ctx.fillStyle = `hsl(${w.hue}, 80%, 60%)`;
            ctx.fillText(w.text, w.x, w.y);
        }
    }

    private computeLayout(config: SceneConfig) {
        const { width, height, words } = config;
        const layout: { text: string; x: number; y: number; size: number; hue: number; w: number; h: number }[] = [];
        const cx = width / 2;
        const cy = height / 2;
        const area = width * height;
        const baseSize = Math.max(12, Math.sqrt(area / 1500));
        const maxWords = Math.min(words.length, 200);
        const golden = Math.PI * (3 - Math.sqrt(5));
        const radiusStep = Math.max(8, Math.min(width, height) * 0.008);
        const ctx = this.ctx;
        // helper to check overlaps
        const intersects = (a: any, b: any) => !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
        for (let i = 0, placed = 0; i < words.length && placed < maxWords; i++) {
            const text = words[i];
            let attempt = 0;
            while (attempt < 200) {
                const size = baseSize * (0.7 + this.rng() * 0.6);
                ctx.font = `${size}px sans-serif`;
                const metrics = ctx.measureText(text);
                const w = Math.ceil(metrics.width);
                const h = Math.ceil(size);
                const r = (placed + attempt) * radiusStep;
                const a = (placed + attempt) * golden;
                const x = Math.floor(cx + Math.cos(a) * r - w / 2);
                const y = Math.floor(cy + Math.sin(a) * r - h / 2);
                const hue = Math.floor(this.rng() * 360);
                const rect = { text, x, y, size, hue, w, h };
                let collides = false;
                for (const other of layout) {
                    if (intersects(rect, other)) { collides = true; break; }
                }
                if (!collides) { layout.push(rect); placed++; break; }
                attempt++;
            }
        }
        return layout;
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


