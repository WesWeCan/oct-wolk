import type { SceneContext, WorkerScene } from '../engine/types';

export class WordCloudScene implements WorkerScene {
    private rng: () => number = () => 0.5;
    private layout: { text: string; x: number; y: number; size: number; hue: number; w: number; h: number }[] = [];
    private configured = false;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private width = 0;
    private height = 0;
    private bgHue: number = 30;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        this.rng = context.createScopedRng('wordcloud.layout');
    }

    configure(params: Record<string, any>): void {
        this.fontFamilyChain = String(params.fontFamilyChain || this.fontFamilyChain);
        const words = Array.isArray(params.words) ? params.words as string[] : [];
        this.layout = this.computeLayout({ width: this.width, height: this.height, words });
        this.configured = true;
        const pHue = Number(params.bgHue);
        this.bgHue = Number.isFinite(pHue) ? (Math.floor(pHue) % 360 + 360) % 360 : Math.floor(this.rng() * 360);
    }

    update(frame: number, dt: number, context: SceneContext): void {
        // no-op for now
    }

    render(target: OffscreenCanvasRenderingContext2D, context: SceneContext): void {
        if (!this.configured) return;
        // background to make transitions visible
        target.fillStyle = `hsl(${this.bgHue}, 25%, 12%)`;
        target.fillRect(0, 0, this.width, this.height);
        target.textAlign = 'center';
        target.textBaseline = 'middle';
        const beat = Number(context.extras?.beat || 0);
        for (const w of this.layout) {
            const pulse = 0.9 + 0.3 * beat;
            const size = w.size * pulse;
            target.font = `${size}px ${this.fontFamilyChain}`;
            target.fillStyle = `hsl(${w.hue}, 80%, 60%)`;
            target.fillText(w.text, w.x, w.y);
        }
    }

    dispose(): void {
        this.layout = [];
    }

    serialize(): any { return { fontFamilyChain: this.fontFamilyChain, layout: this.layout }; }
    deserialize(data: any): void {
        try { if (data?.fontFamilyChain) this.fontFamilyChain = String(data.fontFamilyChain); } catch {}
    }

    private computeLayout(config: { width: number; height: number; words: string[] }) {
        const { width, height, words } = config;
        const layout: { text: string; x: number; y: number; size: number; hue: number; w: number; h: number }[] = [];
        const cx = width / 2;
        const cy = height / 2;
        const area = width * height;
        const baseSize = Math.max(12, Math.sqrt(area / 1500));
        const maxWords = Math.min(words.length, 200);
        const golden = Math.PI * (3 - Math.sqrt(5));
        const radiusStep = Math.max(8, Math.min(width, height) * 0.008);
        // helper to check overlaps
        const intersects = (a: any, b: any) => !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
        for (let i = 0, placed = 0; i < words.length && placed < maxWords; i++) {
            const text = words[i];
            let attempt = 0;
            while (attempt < 200) {
                const size = baseSize * (0.7 + this.rng() * 0.6);
                // approximate width using size * 0.6 * len (no ctx measure here)
                const w = Math.ceil(size * 0.6 * Math.max(1, String(text).length));
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
}


