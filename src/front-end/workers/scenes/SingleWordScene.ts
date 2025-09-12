import type { SceneContext, WorkerScene } from '../engine/types';

export class SingleWordScene implements WorkerScene {
    private words: string[] = [];
    private width = 0;
    private height = 0;
    private currentIndex = 0;
    private lastBeat = 0;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private seededPick: () => number = () => 0.5;
    private bgHue: number = 210;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        // Scoped RNG for initial index
        this.seededPick = context.createScopedRng('singleWord.pick');
    }

    configure(params: Record<string, any>): void {
        const list: string[] = Array.isArray(params.words) ? params.words : ['wolk'];
        this.words = list.map(w => String(w).toUpperCase());
        const wordsLen = Math.max(1, this.words.length);
        this.currentIndex = Math.floor((this.seededPick() || 0) * wordsLen) % wordsLen;
        this.lastBeat = 0;
        if (params.fontFamilyChain) this.fontFamilyChain = String(params.fontFamilyChain);
        // background hue can be configured or derived from seed
        const pHue = Number(params.bgHue);
        this.bgHue = Number.isFinite(pHue) ? (Math.floor(pHue) % 360 + 360) % 360 : Math.floor(this.seededPick() * 360);
    }

    update(frame: number, dt: number, context: SceneContext): void {
        const beat = Number(context.extras?.beat || 0);
        const wordsLen = Math.max(1, this.words.length);
        if (typeof context.extras?.wordOverride === 'string' && context.extras?.wordOverride) {
            const w = String(context.extras.wordOverride).toUpperCase();
            const idx = this.words.indexOf(w);
            if (idx >= 0) this.currentIndex = idx;
        } else if (typeof context.extras?.wordIndex === 'number' && isFinite(context.extras?.wordIndex as number)) {
            const idx = (context.extras!.wordIndex as number);
            this.currentIndex = ((idx % wordsLen) + wordsLen) % wordsLen;
        } else {
            const threshold = 0.07;
            if (beat > threshold && this.lastBeat <= threshold) {
                this.currentIndex = (this.currentIndex + 1) % wordsLen;
            }
            this.lastBeat = beat;
        }
    }

    render(target: OffscreenCanvasRenderingContext2D, context: SceneContext): void {
        const w = this.width;
        const h = this.height;
        const beat = Number(context.extras?.beat || 0);
        // background to make transitions visible
        target.fillStyle = `hsl(${this.bgHue}, 25%, 10%)`;
        target.fillRect(0, 0, w, h);
        const text = this.words[this.currentIndex] || 'WOLK';
        const base = Math.min(w, h) * 0.2;
        const size = base * (0.8 + 0.4 * beat);
        target.textAlign = 'center';
        target.textBaseline = 'middle';
        target.font = `${size}px ${this.fontFamilyChain}`;
        target.fillStyle = '#fff';
        target.fillText(text, Math.floor(w / 2), Math.floor(h / 2));
    }

    dispose(): void {
        // nothing to dispose for 2D scene
    }

    serialize(): any {
        return { words: this.words, fontFamilyChain: this.fontFamilyChain };
    }

    deserialize(data: any): void {
        try {
            if (Array.isArray(data?.words)) this.words = data.words.map((w: any) => String(w));
            if (data?.fontFamilyChain) this.fontFamilyChain = String(data.fontFamilyChain);
        } catch {}
    }
}

