import type { SceneContext, WorkerScene } from '../engine/types';
import { getAnimated } from '../engine/params';

type FitMode = 'contain' | 'cover';

// Helper: Count beats up to current frame (deterministic, frame-based)
function countBeatsUpToFrame(context: SceneContext): number {
    const beatTimes = context.analysis?.beatTimes;
    if (!beatTimes || beatTimes.length === 0) return 0;
    const currentTime = context.time.frame / context.time.fps;
    let count = 0;
    for (const beatTime of beatTimes) {
        if (beatTime <= currentTime) count++;
        else break;
    }
    return count;
}

export class PortraitMaskScene implements WorkerScene {
    private width = 0;
    private height = 0;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private measureCtx: OffscreenCanvasRenderingContext2D | null = null;
    private createScopedRng: ((key: string) => () => number) | null = null;

    // Source image provided by worker message
    private maskBitmap: ImageBitmap | null = null;
    private maskImageUrl: string | null = null;
    private lastRequestedUrl: string | null = null;

    // Processed mask buffers (single channel 0..255)
    private maskBuffer: Uint8ClampedArray | null = null;
    private maskW = 0;
    private maskH = 0;

    // Params (non-animatable configuration)
    private showPreview = true;
    private threshold = 0.5; // 0..1
    private posterizeLevels = 2; // >=1
    private invert = false;
    private blurRadius = 0; // px, 0..8
    private fitMode: FitMode = 'contain';
    private colorFromImage = false;
    private lastUsedThreshold = 0.5; // track for animatable override

    // Background HSL (defaults, can be overridden by animatables)
    private bgHue: number = 210;
    private bgSat: number = 30;
    private bgLight: number = 12;

    // Word swapping (beat-driven, deterministic)
    private swapMode: 'all' | 'sequential' = 'all';
    private swapStride: number = 1;
    private beatThreshold = 0.07;
    private globalOffset = 0;
    private perItemOffsets: number[] = [];
    private seqCursor = 0;

    // Layout
    private words: string[] = [];
    private placements: { x: number; y: number; size: number; word: string; w: number; h: number; wi: number }[] = [];
    private configured = false;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        this.createScopedRng = context.createScopedRng;
        try {
            const off = new OffscreenCanvas(2, 2);
            this.measureCtx = off.getContext('2d');
        } catch { this.measureCtx = null; }
    }

    configure(params: Record<string, any>): void {
        // Accept words and font
        if (Array.isArray(params.words)) this.words = params.words.map(w => String(w));
        if (params.fontFamilyChain) this.fontFamilyChain = String(params.fontFamilyChain);
        
        // Track if we need to rebuild mask
        let needsRebuild = false;
        
        // Accept bitmap (not serializable via JSON clone)
        if (params.maskBitmap instanceof ImageBitmap) {
            this.maskBitmap = params.maskBitmap as ImageBitmap;
            this.maskBuffer = null;
            needsRebuild = true;
        }
        // Accept persisted URL (like ModelScene asset URLs)
        if (typeof (params as any)?.maskImageUrl === 'string') {
            const url = String((params as any).maskImageUrl);
            if (url && url !== this.maskImageUrl) {
                this.maskImageUrl = url;
                this.loadMaskFromUrl(url);
                // loadMaskFromUrl will rebuild when ready, no need to rebuild now
            }
        }
        
        // Track changes to mask processing params
        const oldThreshold = this.threshold;
        const oldPosterize = this.posterizeLevels;
        const oldInvert = this.invert;
        const oldBlur = this.blurRadius;
        const oldFitMode = this.fitMode;
        
        // Mask controls
        if (Number.isFinite(params?.mask?.threshold)) this.threshold = Math.max(0, Math.min(1, Number(params.mask.threshold)));
        if (Number.isFinite(params?.mask?.posterizeLevels)) this.posterizeLevels = Math.max(1, Math.floor(Number(params.mask.posterizeLevels)));
        if (typeof params?.mask?.invert === 'boolean') this.invert = !!params.mask.invert;
        if (Number.isFinite(params?.mask?.blur)) this.blurRadius = Math.max(0, Math.min(16, Math.floor(Number(params.mask.blur))));
        // Fit controls
        const fm = String(params?.fit?.mode || this.fitMode);
        this.fitMode = (fm === 'cover') ? 'cover' : 'contain';
        // Preview toggle
        if (typeof params?.mask?.preview === 'boolean') this.showPreview = !!params.mask.preview;
        if (typeof params?.colorFromImage === 'boolean') this.colorFromImage = !!params.colorFromImage;

        // Background HSL (defaults for animatables)
        const b = params?.background || {};
        if (Number.isFinite(b.hue)) this.bgHue = ((Number(b.hue) % 360) + 360) % 360;
        if (Number.isFinite(b.sat)) this.bgSat = Math.max(0, Math.min(100, Number(b.sat)));
        if (Number.isFinite(b.light)) this.bgLight = Math.max(0, Math.min(100, Number(b.light)));

        // Word swapping params
        const sm = String((params as any)?.swapMode || this.swapMode);
        this.swapMode = (sm === 'sequential') ? 'sequential' : 'all';
        if (Number.isFinite((params as any)?.swapStride)) this.swapStride = Math.max(1, Math.floor(Number((params as any).swapStride)));
        if (Number.isFinite((params as any)?.beatThreshold)) this.beatThreshold = Math.max(0, Math.min(1, Number((params as any).beatThreshold)));

        // Only rebuild if params changed
        if (this.threshold !== oldThreshold || this.posterizeLevels !== oldPosterize || 
            this.invert !== oldInvert || this.blurRadius !== oldBlur ||
            this.fitMode !== oldFitMode) {
            needsRebuild = true;
        }

        // Rebuild mask only when params change or new bitmap arrives
        if (needsRebuild && this.maskBitmap) {
            this.rebuildMask();
            // Clear placements to force recompute
            this.placements = [];
        }

        // Reset word swapping state (will be calculated frame-deterministically in update)
        this.globalOffset = 0;
        this.seqCursor = 0;
        
        this.configured = true;
    }

    update(frame: number, dt: number, context: SceneContext): void {
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        
        // Check for animatable mask threshold override (dynamic mask morphing)
        const animThreshold = Number(getAnimated(animated, 'mask.thresholdOverride', NaN));
        if (Number.isFinite(animThreshold)) {
            const newThreshold = Math.max(0, Math.min(1, animThreshold));
            if (Math.abs(newThreshold - this.lastUsedThreshold) > 0.001) {
                this.lastUsedThreshold = newThreshold;
                if (this.maskBitmap) {
                    this.rebuildMask(newThreshold);
                    this.placements = []; // Force recompute
                }
            }
        } else if (this.lastUsedThreshold !== this.threshold) {
            // Reset to param threshold if no override
            this.lastUsedThreshold = this.threshold;
            if (this.maskBitmap) {
                this.rebuildMask(this.threshold);
                this.placements = [];
            }
        }
        
        // Frame-deterministic word swapping based on beat count
        const beatCount = countBeatsUpToFrame(context);
        const n = this.placements.length;
        const wordsLen = this.words.length;
        
        if (wordsLen > 0 && n > 0) {
            if (this.swapMode === 'all') {
                // All words swap at once on each beat
                this.globalOffset = (beatCount * this.swapStride) % wordsLen;
            } else {
                // Sequential: distribute beat counts across placement slots
                this.perItemOffsets = new Array(n).fill(0);
                const totalSwaps = beatCount * this.swapStride;
                for (let i = 0; i < totalSwaps; i++) {
                    const idx = i % n;
                    this.perItemOffsets[idx] = (this.perItemOffsets[idx] + 1) % wordsLen;
                }
                this.seqCursor = totalSwaps % n;
            }
        }
    }

    render(target: OffscreenCanvasRenderingContext2D, context: SceneContext): void {
        if (!this.configured) return;
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        const beat = Math.max(0, Math.min(1, Number(context.extras?.beat || 0)));
        
        // Helper functions
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        const hsla = (hh: number, ss: number, ll: number, aa: number) => `hsla(${Math.floor((hh % 360 + 360) % 360)}, ${Math.floor(Math.max(0, Math.min(100, ss)))}%, ${Math.floor(Math.max(0, Math.min(100, ll)))}%, ${clamp01(aa)})`;
        
        // Scene scale with beat pulse (like WordCloudScene's cloud.scale)
        const baseScale = Math.max(0, Number(getAnimated(animated, 'scene.scale', 1))) * (1 + 0.06 * beat);
        
        // Apply scene transform
        target.save();
        const cx = this.width / 2;
        const cy = this.height / 2;
        target.translate(cx, cy);
        target.scale(baseScale, baseScale);
        target.translate(-cx, -cy);
        
        // Layer 1: Source image with opacity and desaturation
        const imageOpacity = clamp01(Number(getAnimated(animated, 'image.opacity', 1)));
        const imageDesaturation = clamp01(Number(getAnimated(animated, 'image.desaturation', 0)));
        
        if (this.maskBitmap && imageOpacity > 0) {
            const sw = this.maskBitmap.width;
            const sh = this.maskBitmap.height;
            const scaleContain = Math.min(this.width / sw, this.height / sh);
            const scaleCover = Math.max(this.width / sw, this.height / sh);
            const s = (this.fitMode === 'cover' ? scaleCover : scaleContain);
            const dw = Math.max(1, Math.floor(sw * s));
            const dh = Math.max(1, Math.floor(sh * s));
            const dx = Math.floor((this.width - dw) / 2);
            const dy = Math.floor((this.height - dh) / 2);
            
            target.save();
            target.globalAlpha = imageOpacity;
            
            // Apply desaturation if needed
            if (imageDesaturation > 0) {
                target.filter = `saturate(${1 - imageDesaturation})`;
            }
            
            target.drawImage(this.maskBitmap, dx, dy, dw, dh);
            target.restore();
        }
        
        // Layer 2: Solid background color (over image)
        const bgHue = Number(getAnimated(animated, 'background.hue', this.bgHue));
        const bgSat = Number(getAnimated(animated, 'background.sat', this.bgSat));
        const bgLight = Number(getAnimated(animated, 'background.light', this.bgLight));
        const bgOpacity = clamp01(Number(getAnimated(animated, 'background.opacity', 1)));
        
        target.fillStyle = hsla(bgHue, bgSat, bgLight, bgOpacity);
        target.fillRect(0, 0, this.width, this.height);
        
        // Check if mask is ready
        if (!this.maskBitmap || !this.maskBuffer) {
            // Simple message
            target.fillStyle = '#888';
            target.font = `16px ${this.fontFamilyChain}`;
            target.textAlign = 'center';
            target.textBaseline = 'middle';
            target.fillText('Upload a portrait image to begin', this.width / 2, this.height / 2);
            target.restore();
            return;
        }

        // Layer 3: Words - Compute layout if needed (only once, or when config changes)
        if (this.placements.length === 0) {
            this.computePlacements(target, animated);
        }
        
        // Render words with swapping
        target.textAlign = 'center';
        target.textBaseline = 'middle';
        // Word size scale with beat pulse (like WordCloudScene)
        const wordSizeScale = Math.max(0, Number(getAnimated(animated, 'word.scale', 1))) * (0.9 + 0.3 * beat);
        const wordOpacity = clamp01(Number(getAnimated(animated, 'word.opacity', 1)));
        
        // Prepare source image data if color sampling enabled
        let srcData: ImageData | null = null;
        if (this.colorFromImage && this.maskBitmap) {
            const off = new OffscreenCanvas(this.width, this.height);
            const ctx = off.getContext('2d');
            if (ctx) {
                const sw = this.maskBitmap.width;
                const sh = this.maskBitmap.height;
                const scaleContain = Math.min(this.width / sw, this.height / sh);
                const scaleCover = Math.max(this.width / sw, this.height / sh);
                const s = (this.fitMode === 'cover' ? scaleCover : scaleContain);
                const dw = Math.max(1, Math.floor(sw * s));
                const dh = Math.max(1, Math.floor(sh * s));
                const dx = Math.floor((this.width - dw) / 2);
                const dy = Math.floor((this.height - dh) / 2);
                ctx.drawImage(this.maskBitmap, dx, dy, dw, dh);
                srcData = ctx.getImageData(0, 0, this.width, this.height);
            }
        }
        
        for (let idx = 0; idx < this.placements.length; idx++) {
            const p = this.placements[idx];
            const size = p.size * wordSizeScale;
            target.font = `400 ${size}px ${this.fontFamilyChain}`;
            
            // Resolve current word with swapping offsets
            let displayText = 'WOLK';
            if (this.words && this.words.length) {
                const wordsLen = this.words.length;
                const base = (p.wi % wordsLen + wordsLen) % wordsLen;
                const off = (this.globalOffset + (this.perItemOffsets[idx] || 0)) % wordsLen;
                displayText = this.words[(base + off) % wordsLen];
            }
            
            // Color from image or default
            if (srcData) {
                const ix = Math.max(0, Math.min(this.width - 1, p.x | 0));
                const iy = Math.max(0, Math.min(this.height - 1, p.y | 0));
                const idx4 = (iy * this.width + ix) * 4;
                const r = srcData.data[idx4];
                const g = srcData.data[idx4 + 1];
                const b = srcData.data[idx4 + 2];
                target.fillStyle = `rgba(${r},${g},${b},${wordOpacity})`;
            } else {
                target.fillStyle = hsla(0, 0, 95, wordOpacity);
            }
            
            target.fillText(displayText, p.x, p.y);
        }
        
        // Layer 4: Preview overlay (semi-transparent mask on top)
        if (this.showPreview) {
            const img = new ImageData(this.width, this.height);
            const buf = img.data;
            for (let i = 0, j = 0; i < this.maskBuffer.length; i++, j += 4) {
                const v = this.maskBuffer[i];
                buf[j] = v; buf[j + 1] = v; buf[j + 2] = v; buf[j + 3] = Math.floor(v * 0.5); // 50% transparency
            }
            const off = new OffscreenCanvas(this.width, this.height);
            const ctx = off.getContext('2d');
            if (ctx) {
                ctx.putImageData(img, 0, 0);
                target.drawImage(off, 0, 0);
            }
        }
        
        // Restore scene transform
        target.restore();
    }

    private computePlacements(target: OffscreenCanvasRenderingContext2D, animated: any): void {
        const words = this.words.length ? this.words : ['WOLK'];
        
        // Parameters from animatables
        const maxWords = Math.floor(Number(getAnimated(animated, 'layout.maxWords', 120)));
        const minSize = Math.max(6, Number(getAnimated(animated, 'layout.minSize', Math.max(12, Math.sqrt(this.width * this.height / 5000)))));
        const maxSize = Math.max(minSize + 4, Number(getAnimated(animated, 'layout.maxSize', Math.max(minSize + 4, Math.sqrt(this.width * this.height / 1200)))));
        
        const sizeSteps = 8;
        const attemptsPerSize = 600;
        const gridCell = Math.max(6, Math.floor(Math.min(this.width, this.height) / 180));

        const cols = Math.ceil(this.width / gridCell);
        const rows = Math.ceil(this.height / gridCell);
        const occ = new Uint8Array(cols * rows);
        const occSet = (x0: number, y0: number, x1: number, y1: number) => {
            const ix0 = Math.max(0, Math.floor(x0 / gridCell));
            const iy0 = Math.max(0, Math.floor(y0 / gridCell));
            const ix1 = Math.min(cols - 1, Math.floor(x1 / gridCell));
            const iy1 = Math.min(rows - 1, Math.floor(y1 / gridCell));
            for (let y = iy0; y <= iy1; y++) {
                for (let x = ix0; x <= ix1; x++) occ[y * cols + x] = 1;
            }
        };
        const occTest = (x0: number, y0: number, x1: number, y1: number) => {
            const ix0 = Math.max(0, Math.floor(x0 / gridCell));
            const iy0 = Math.max(0, Math.floor(y0 / gridCell));
            const ix1 = Math.min(cols - 1, Math.floor(x1 / gridCell));
            const iy1 = Math.min(rows - 1, Math.floor(y1 / gridCell));
            for (let y = iy0; y <= iy1; y++) {
                for (let x = ix0; x <= ix1; x++) if (occ[y * cols + x]) return true;
            }
            return false;
        };

        const margin = 2;
        const marginTest = (x0: number, y0: number, x1: number, y1: number) => {
            const cx = (x0 + x1) >> 1;
            const cy = (y0 + y1) >> 1;
            const e = this.sampleMask01(cx, cy) > 0.5
                && this.sampleMask01(cx - margin, cy) > 0.5
                && this.sampleMask01(cx + margin, cy) > 0.5
                && this.sampleMask01(cx, cy - margin) > 0.5
                && this.sampleMask01(cx, cy + margin) > 0.5;
            return e;
        };

        this.placements = [];
        const sizes: number[] = [];
        for (let s = 0; s < sizeSteps; s++) {
            const t = s / Math.max(1, sizeSteps - 1);
            sizes.push(maxSize * (1 - t) + minSize * t);
        }
        const rng = this.createScopedRng?.('portraitMask.placement') || (() => 0.5);
        const rnd = (a = 1) => rng() * a;
        const pickWord = (i: number) => words[i % words.length];

        for (const size of sizes) {
            const estW = Math.ceil(size * 0.58 * 6);
            const estH = Math.ceil(size * 1.0);
            let tries = 0;
            while (tries++ < attemptsPerSize && this.placements.length < maxWords) {
                let x = Math.floor(rnd(this.width));
                let y = Math.floor(rnd(this.height));
                const m = this.sampleMask01(x, y);
                if (m <= rnd(1)) continue;
                const padX = Math.max(2, Math.floor(estW * 0.1));
                const padY = Math.max(2, Math.floor(estH * 0.1));
                x = Math.max(padX, Math.min(this.width - padX - 1, x));
                y = Math.max(padY, Math.min(this.height - padY - 1, y));
                const x0 = x - Math.floor(estW / 2);
                const y0 = y - Math.floor(estH / 2);
                const x1 = x0 + estW;
                const y1 = y0 + estH;
                if (x0 < 0 || y0 < 0 || x1 >= this.width || y1 >= this.height) continue;
                const inside = (
                    this.sampleMask01(x, y) > 0.5 &&
                    this.sampleMask01(x0, y0) > 0.5 &&
                    this.sampleMask01(x1, y0) > 0.5 &&
                    this.sampleMask01(x0, y1) > 0.5 &&
                    this.sampleMask01(x1, y1) > 0.5
                );
                if (!inside) continue;
                if (occTest(x0, y0, x1, y1)) continue;
                if (!marginTest(x0, y0, x1, y1)) continue;
                const word = pickWord(this.placements.length);
                let w = estW, h = estH;
                try {
                    target.font = `400 ${size}px ${this.fontFamilyChain}`;
                    const mtx = target.measureText(word);
                    w = Math.ceil(mtx.width || estW);
                    h = Math.ceil(((mtx as any).actualBoundingBoxAscent || 0) + ((mtx as any).actualBoundingBoxDescent || 0)) || estH;
                } catch {}
                const x0m = x - Math.floor(w / 2);
                const y0m = y - Math.floor(h / 2);
                const x1m = x0m + w;
                const y1m = y0m + h;
                if (x0m < 0 || y0m < 0 || x1m >= this.width || y1m >= this.height) continue;
                if (occTest(x0m, y0m, x1m, y1m)) continue;
                if (!marginTest(x0m, y0m, x1m, y1m)) continue;
                this.placements.push({ x, y, size, word, w, h, wi: this.placements.length });
                occSet(x0m, y0m, x1m, y1m);
            }
        }
        
        // Initialize per-item offsets for sequential swapping
        this.perItemOffsets = new Array(this.placements.length).fill(0);
    }

    dispose(): void {
        this.maskBuffer = null;
        this.placements = [];
        // Don't close the bitmap - it might be shared/reused by the worker
        // Only clear our reference
        this.maskBitmap = null;
    }

    serialize(): any {
        return {
            mask: { threshold: this.threshold, posterizeLevels: this.posterizeLevels, invert: this.invert, blur: this.blurRadius, preview: this.showPreview },
            maskImageUrl: this.maskImageUrl,
            fit: { mode: this.fitMode },
            fontFamilyChain: this.fontFamilyChain,
            background: { hue: this.bgHue, sat: this.bgSat, light: this.bgLight },
            swapMode: this.swapMode,
            swapStride: this.swapStride,
            beatThreshold: this.beatThreshold,
        };
    }

    deserialize(data: any): void {
        try {
            const m = data?.mask || {};
            if (Number.isFinite(m.threshold)) this.threshold = Math.max(0, Math.min(1, Number(m.threshold)));
            if (Number.isFinite(m.posterizeLevels)) this.posterizeLevels = Math.max(1, Math.floor(Number(m.posterizeLevels)));
            if (typeof m.invert === 'boolean') this.invert = !!m.invert;
            if (Number.isFinite(m.blur)) this.blurRadius = Math.max(0, Math.min(16, Math.floor(Number(m.blur))));
            if (typeof m.preview === 'boolean') this.showPreview = !!m.preview;
            if (typeof data?.maskImageUrl === 'string') this.maskImageUrl = String(data.maskImageUrl);
            const f = data?.fit || {};
            const fm = String(f.mode || this.fitMode);
            this.fitMode = (fm === 'cover') ? 'cover' : 'contain';
            if (data?.fontFamilyChain) this.fontFamilyChain = String(data.fontFamilyChain);
            // Background HSL
            const b = data?.background || {};
            if (Number.isFinite(b.hue)) this.bgHue = ((Number(b.hue) % 360) + 360) % 360;
            if (Number.isFinite(b.sat)) this.bgSat = Math.max(0, Math.min(100, Number(b.sat)));
            if (Number.isFinite(b.light)) this.bgLight = Math.max(0, Math.min(100, Number(b.light)));
            // Word swapping
            const sm = String(data?.swapMode || this.swapMode);
            this.swapMode = (sm === 'sequential') ? 'sequential' : 'all';
            if (Number.isFinite(data?.swapStride)) this.swapStride = Math.max(1, Math.floor(Number(data.swapStride)));
            if (Number.isFinite(data?.beatThreshold)) this.beatThreshold = Math.max(0, Math.min(1, Number(data.beatThreshold)));
        } catch {}
    }

    private async loadMaskFromUrl(url: string) {
        try {
            if (!url || url === this.lastRequestedUrl) return;
            this.lastRequestedUrl = url;
            const resp = await fetch(url);
            if (!resp.ok) return;
            const blob = await resp.blob();
            const bmp = await (globalThis as any).createImageBitmap(blob);
            // Only apply if still current
            if (url === this.lastRequestedUrl) {
                // Don't close old bitmap - it's not safe if worker is still using it
                this.maskBitmap = bmp;
                this.maskBuffer = null;
                this.rebuildMask();
            } else {
                // Close the bitmap we won't use
                try { (bmp as any)?.close?.(); } catch {}
            }
        } catch {}
    }

    private rebuildMask(thresholdOverride?: number) {
        if (!this.maskBitmap) return;
        const w = this.width;
        const h = this.height;
        const off = new OffscreenCanvas(w, h);
        const ctx = off.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        // Compute fit rect (using animatable fitScale would require context, so we use base fitScale here)
        const sw = this.maskBitmap.width;
        const sh = this.maskBitmap.height;
        const scaleContain = Math.min(w / sw, h / sh);
        const scaleCover = Math.max(w / sw, h / sh);
        const s = (this.fitMode === 'cover' ? scaleCover : scaleContain);
        const dw = Math.max(1, Math.floor(sw * s));
        const dh = Math.max(1, Math.floor(sh * s));
        const dx = Math.floor((w - dw) / 2);
        const dy = Math.floor((h - dh) / 2);
        ctx.drawImage(this.maskBitmap, dx, dy, dw, dh);
        const img = ctx.getImageData(0, 0, w, h);
        // Convert to luminance and apply controls
        const buf = new Uint8ClampedArray(w * h);
        const threshold = thresholdOverride !== undefined ? thresholdOverride : this.threshold;
        for (let i = 0, j = 0; i < buf.length; i++, j += 4) {
            const r = img.data[j];
            const g = img.data[j + 1];
            const b = img.data[j + 2];
            let y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // 0..1
            // Posterize
            if (this.posterizeLevels > 1) {
                y = Math.floor(y * this.posterizeLevels) / (this.posterizeLevels - 1);
                if (!isFinite(y)) y = 0;
                y = Math.max(0, Math.min(1, y));
            }
            // Threshold to binary-ish mask
            y = y < threshold ? 1 : 0;
            if (this.invert) y = 1 - y;
            buf[i] = Math.floor(y * 255);
        }
        if (this.blurRadius > 0) this.boxBlurMono(buf, w, h, this.blurRadius);
        this.maskBuffer = buf;
        this.maskW = w; this.maskH = h;
    }

    private boxBlurMono(buf: Uint8ClampedArray, w: number, h: number, r: number) {
        const tmp = new Uint8ClampedArray(buf.length);
        const div = (2 * r + 1);
        // horizontal
        for (let y = 0; y < h; y++) {
            let acc = 0;
            const row = y * w;
            for (let x = -r; x <= r; x++) acc += buf[row + Math.max(0, Math.min(w - 1, x))];
            for (let x = 0; x < w; x++) {
                tmp[row + x] = Math.floor(acc / div);
                const x0 = Math.max(0, x - r);
                const x1 = Math.min(w - 1, x + r + 1);
                acc += buf[row + x1] - buf[row + x0];
            }
        }
        // vertical
        for (let x = 0; x < w; x++) {
            let acc = 0;
            for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
            for (let y = 0; y < h; y++) {
                buf[y * w + x] = Math.floor(acc / div);
                const y0 = Math.max(0, y - r);
                const y1 = Math.min(h - 1, y + r + 1);
                acc += tmp[y1 * w + x] - tmp[y0 * w + x];
            }
        }
    }

    private sampleMask01(x: number, y: number): number {
        if (!this.maskBuffer) return 0;
        if (x < 0 || y < 0 || x >= this.maskW || y >= this.maskH) return 0;
        return (this.maskBuffer[y * this.maskW + x] || 0) / 255;
    }
}


