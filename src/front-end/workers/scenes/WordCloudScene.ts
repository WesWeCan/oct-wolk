import type { SceneContext, WorkerScene } from '../engine/types';
import { getAnimated } from '../engine/params';

export class WordCloudScene implements WorkerScene {
    private rng: () => number = () => 0.5;
    private layout: { text: string; x: number; y: number; size: number; hue: number; sat: number; light: number; w: number; h: number; wi: number }[] = [];
    private configured = false;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private fontStyle: 'normal' | 'italic' | 'oblique' = 'normal';
    private fontWeight: number | string = 400;
    private width = 0;
    private height = 0;
    private bgHue: number = 30;
    // core params (non-animatable)
    private layoutMode: 'spiral' | 'ring' | 'grid' = 'spiral';
    private gridSnap = false;
    private gridSize = 8;
    private fillSpace = false;
    private ringBands = 3;
    private measureCtx: OffscreenCanvasRenderingContext2D | null = null;
    // color palette params (non-animatable)
    private colorPalette: 'mono' | 'analogous' | 'complementary' | 'triad' | 'custom' = 'mono';
    private colorSeedOffset = 0;
    private colorAssignment: 'order' | 'hash' | 'position' | 'band' = 'order';
    private colorSatMin = 70; private colorSatMax = 85;
    private colorLightMin = 50; private colorLightMax = 65;
    // grid params (non-animatable)
    private gridColumns = 6;
    private gridRowHeight = 0; // auto when 0
    private gridJustify: 'center' | 'start' | 'end' | 'space' = 'center';
    private gridRandomOffset = 0; // 0..1
    private gridCellPadding = 6;
    // animation params
    private globalHueShift: number = 0;
    private cloudScale: number = 1;
    private cloudRotationDeg: number = 0;
    private jitter: number = 0; // 0..1 amount of frame jitter (seeded)

    // word set and beat-driven swapping
    private words: string[] = [];
    private swapMode: 'all' | 'sequential' = 'all';
    private swapStride: number = 1;
    private beatThreshold = 0.07;
    private lastBeat = 0;
    private globalOffset = 0;
    private perItemOffsets: number[] = [];
    private seqCursor = 0;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        this.rng = context.createScopedRng('wordcloud.layout');
        try {
            const off = new OffscreenCanvas(2, 2);
            this.measureCtx = off.getContext('2d');
        } catch { this.measureCtx = null; }
    }

    configure(params: Record<string, any>): void {
        this.fontFamilyChain = String(params.fontFamilyChain || this.fontFamilyChain);
        if (params.fontStyle) this.fontStyle = String(params.fontStyle) as any;
        if (params.fontWeight != null) this.fontWeight = params.fontWeight as any;
        // core params
        const lm = String((params as any)?.layoutMode || this.layoutMode);
        this.layoutMode = lm === 'ring' ? 'ring' : (lm === 'grid' ? 'grid' : 'spiral');
        if (typeof (params as any)?.gridSnap === 'boolean') this.gridSnap = !!(params as any).gridSnap;
        if (Number.isFinite((params as any)?.gridSize)) this.gridSize = Math.max(1, Math.floor(Number((params as any).gridSize)));
        if (typeof (params as any)?.fillSpace === 'boolean') this.fillSpace = !!(params as any).fillSpace;
        if (Number.isFinite((params as any)?.ringBands)) this.ringBands = Math.max(1, Math.min(24, Math.floor(Number((params as any).ringBands))));

        // colors
        const cp = String((params as any)?.color?.palette || this.colorPalette);
        this.colorPalette = (cp === 'analogous' || cp === 'complementary' || cp === 'triad' || cp === 'custom') ? (cp as any) : 'mono';
        if (Number.isFinite((params as any)?.color?.seedOffset)) this.colorSeedOffset = Math.floor(Number((params as any).color.seedOffset));
        const ca = String((params as any)?.color?.assignment || this.colorAssignment);
        this.colorAssignment = (ca === 'hash' || ca === 'position' || ca === 'band') ? (ca as any) : 'order';
        if (Number.isFinite((params as any)?.color?.satMin)) this.colorSatMin = Math.max(0, Math.min(100, Number((params as any).color.satMin)));
        if (Number.isFinite((params as any)?.color?.satMax)) this.colorSatMax = Math.max(this.colorSatMin, Math.min(100, Number((params as any).color.satMax)));
        if (Number.isFinite((params as any)?.color?.lightMin)) this.colorLightMin = Math.max(0, Math.min(100, Number((params as any).color.lightMin)));
        if (Number.isFinite((params as any)?.color?.lightMax)) this.colorLightMax = Math.max(this.colorLightMin, Math.min(100, Number((params as any).color.lightMax)));

        // grid params
        if (Number.isFinite((params as any)?.grid?.columns)) this.gridColumns = Math.max(1, Math.floor(Number((params as any).grid.columns)));
        if (Number.isFinite((params as any)?.grid?.rowHeight)) this.gridRowHeight = Math.max(0, Math.floor(Number((params as any).grid.rowHeight)));
        const gj = String((params as any)?.grid?.justify || this.gridJustify);
        this.gridJustify = (gj === 'start' || gj === 'end' || gj === 'space') ? (gj as any) : 'center';
        if (Number.isFinite((params as any)?.grid?.randomOffset)) this.gridRandomOffset = Math.max(0, Math.min(1, Number((params as any).grid.randomOffset)));
        if (Number.isFinite((params as any)?.grid?.cellPadding)) this.gridCellPadding = Math.max(0, Math.floor(Number((params as any).grid.cellPadding)));

        // words + swapping
        this.words = Array.isArray(params.words) ? (params.words as string[]).map(w => String(w)) : [];
        const sm = String((params as any)?.swapMode || this.swapMode);
        this.swapMode = (sm === 'sequential') ? 'sequential' : 'all';
        if (Number.isFinite((params as any)?.swapStride)) this.swapStride = Math.max(1, Math.floor(Number((params as any).swapStride)));
        if (Number.isFinite((params as any)?.beatThreshold)) this.beatThreshold = Math.max(0, Math.min(1, Number((params as any).beatThreshold)));

        this.layout = this.computeLayout({ width: this.width, height: this.height, words: this.words });
        this.perItemOffsets = new Array(this.layout.length).fill(0);
        this.globalOffset = 0;
        this.seqCursor = 0;
        this.lastBeat = 0;
        this.configured = true;
        const pHue = Number(params.bgHue);
        this.bgHue = Number.isFinite(pHue) ? (Math.floor(pHue) % 360 + 360) % 360 : Math.floor(this.rng() * 360);
    }

    update(frame: number, dt: number, context: SceneContext): void {
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        // Read overrides (do not mutate layout; consume during render)
        this.globalHueShift = Number(getAnimated(animated, 'word.globalHueShift', 0)) || 0;
        this.cloudScale = Math.max(0, Number(getAnimated(animated, 'cloud.scale', 1)) || 1);
        this.cloudRotationDeg = Number(getAnimated(animated, 'cloud.rotationDeg', 0)) || 0;
        this.jitter = Math.max(0, Math.min(1, Number(getAnimated(animated, 'cloud.jitter', 0)) || 0));
        // Beat detection (like SingleWordScene)
        const beatVal = Math.max(0, Math.min(1, Number(context.extras?.beat || 0)));
        const thr = (animated && Number.isFinite((animated as any)['beatThreshold']))
            ? Math.max(0, Math.min(1, Number((animated as any)['beatThreshold'])))
            : this.beatThreshold;
        if (beatVal > thr && this.lastBeat <= thr) {
            const n = this.layout.length;
            const wordsLen = this.words.length;
            if (wordsLen > 0 && n > 0) {
                if (this.swapMode === 'all') {
                    this.globalOffset = (this.globalOffset + this.swapStride) % wordsLen;
                } else {
                    for (let k = 0; k < this.swapStride; k++) {
                        const idx = this.seqCursor % n;
                        this.perItemOffsets[idx] = (this.perItemOffsets[idx] + 1) % wordsLen;
                        this.seqCursor = (this.seqCursor + 1) % n;
                    }
                }
            }
        }
        this.lastBeat = beatVal;
        // Background explicit override
        const bgHue = getAnimated(animated, 'background.hue', null as any);
        if (Number.isFinite(bgHue as any)) this.bgHue = ((Number(bgHue) % 360) + 360) % 360;
    }

    render(target: OffscreenCanvasRenderingContext2D, context: SceneContext): void {
        if (!this.configured) return;
        // background to make transitions visible
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        const bgSat = Number.isFinite(getAnimated(animated, 'background.sat', NaN) as any) ? Number(getAnimated(animated, 'background.sat', 25)) : 25;
        const bgLight = Number.isFinite(getAnimated(animated, 'background.light', NaN) as any) ? Number(getAnimated(animated, 'background.light', 12)) : 12;
        target.fillStyle = `hsl(${this.bgHue}, ${bgSat}%, ${bgLight}%)`;
        target.fillRect(0, 0, this.width, this.height);
        target.textAlign = 'center';
        target.textBaseline = 'middle';
        const beat = Number(context.extras?.beat || 0);
        // Cloud transform with auto-fit to safe area
        const baseScale = this.cloudScale * (1 + 0.06 * beat);
        const rot = (this.cloudRotationDeg * Math.PI) / 180;
        const cx = this.width / 2;
        const cy = this.height / 2;
        // Estimate common word size scale (applies to all words equally)
        const wordSizeScale = Math.max(0, Number(getAnimated(animated, 'word.scale', 1))) * (0.9 + 0.3 * beat);
        // Compute unrotated bounds of the laid out words at current wordSizeScale
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const w of this.layout) {
            const halfW = (w.w / 2) * wordSizeScale;
            const halfH = (w.h / 2) * wordSizeScale;
            if (w.x - halfW < minX) minX = w.x - halfW;
            if (w.x + halfW > maxX) maxX = w.x + halfW;
            if (w.y - halfH < minY) minY = w.y - halfH;
            if (w.y + halfH > maxY) maxY = w.y + halfH;
        }
        const contentW0 = Math.max(1, maxX - minX);
        const contentH0 = Math.max(1, maxY - minY);
        // Inflate bounds for rotation (AABB of rotated rect)
        const c = Math.abs(Math.cos(rot));
        const s = Math.abs(Math.sin(rot));
        const contentWRot = c * contentW0 + s * contentH0;
        const contentHRot = s * contentW0 + c * contentH0;
        // Safe area (5% margin each side)
        const margin = 0.06;
        const safeW = Math.max(1, this.width * (1 - 2 * margin));
        const safeH = Math.max(1, this.height * (1 - 2 * margin));
        const autoScale = Math.min(1, safeW / Math.max(1, contentWRot * baseScale), safeH / Math.max(1, contentHRot * baseScale));
        const scale = baseScale * autoScale;
        target.save();
        target.translate(cx, cy);
        if (rot) target.rotate(rot);
        target.scale(scale, scale);
        target.translate(-cx, -cy);
        for (let idx = 0; idx < this.layout.length; idx++) {
            const w = this.layout[idx];
            const pulse = 0.9 + 0.3 * beat;
            const sizeScale = Math.max(0, Number(getAnimated(animated, 'word.scale', 1))) * pulse;
            const opacity = Math.max(0, Math.min(1, Number(getAnimated(animated, 'word.opacity', 1))));
            const size = w.size * sizeScale;
            target.font = `${this.fontStyle} ${this.fontWeight} ${size}px ${this.fontFamilyChain}`;
            // Resolve current word text deterministically from offsets
            let displayText = 'WOLK';
            if (this.words && this.words.length) {
                const wordsLen = this.words.length;
                const base = (w.wi % wordsLen + wordsLen) % wordsLen;
                const off = (this.globalOffset + (this.perItemOffsets[idx] || 0)) % wordsLen;
                displayText = this.words[(base + off) % wordsLen];
            }
            // Base color from palette (hue) + animatable overrides
            let hue = (w.hue + (Number(getAnimated(animated, 'word.text.hue', 0)) || 0) + this.globalHueShift) % 360;
            const textSat = Number(getAnimated(animated, 'word.text.sat', w.sat)) || w.sat;
            const textLight = Number(getAnimated(animated, 'word.text.light', w.light)) || w.light;
            const wordOpacity = opacity;
            // Stroke
            const strokeWidth = Math.max(0, Number(getAnimated(animated, 'word.stroke.width', 0)) || 0);
            const strokeOpacity = Math.max(0, Math.min(1, Number(getAnimated(animated, 'word.stroke.opacity', 0)) || 0));
            const strokeHue = Number(getAnimated(animated, 'word.stroke.hue', hue)) || hue;
            const strokeSat = Number(getAnimated(animated, 'word.stroke.sat', 0)) || 0;
            const strokeLight = Number(getAnimated(animated, 'word.stroke.light', 0)) || 0;
            // Shadow
            const shadowBlur = Math.max(0, Number(getAnimated(animated, 'word.shadow.blur', 0)) || 0);
            const shadowOpacity = Math.max(0, Math.min(1, Number(getAnimated(animated, 'word.shadow.opacity', 0)) || 0));
            const shadowHue = Number(getAnimated(animated, 'word.shadow.hue', 0)) || 0;
            const shadowSat = Number(getAnimated(animated, 'word.shadow.sat', 0)) || 0;
            const shadowLight = Number(getAnimated(animated, 'word.shadow.light', 0)) || 0;
            // Glow
            const glowSize = Math.max(0, Number(getAnimated(animated, 'word.glow.size', 0)) || 0);
            const glowOpacity = Math.max(0, Math.min(1, Number(getAnimated(animated, 'word.glow.opacity', 0)) || 0));
            const glowHue = Number(getAnimated(animated, 'word.glow.hue', hue)) || hue;
            const glowSat = Number(getAnimated(animated, 'word.glow.sat', textSat)) || textSat;
            const glowLight = Number(getAnimated(animated, 'word.glow.light', Math.max(50, textLight))) || Math.max(50, textLight);

            const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
            const hsla = (hh: number, ss: number, ll: number, aa: number) => `hsla(${Math.floor((hh % 360 + 360) % 360)}, ${Math.floor(Math.max(0, Math.min(100, ss)))}%, ${Math.floor(Math.max(0, Math.min(100, ll)))}%, ${clamp01(aa)})`;

            // Glow pass
            if (glowSize > 0 && glowOpacity > 0) {
                target.save();
                target.shadowBlur = glowSize;
                target.shadowColor = hsla(glowHue, glowSat, glowLight, glowOpacity);
                target.fillStyle = hsla(hue, textSat, textLight, 0);
                target.fillText(displayText, w.x, w.y);
                target.restore();
            }

            // Shadow pass
            if (shadowBlur > 0 && shadowOpacity > 0) {
                target.save();
                target.shadowBlur = shadowBlur;
                target.shadowColor = hsla(shadowHue, shadowSat, shadowLight, shadowOpacity);
                target.fillStyle = hsla(hue, textSat, textLight, 0);
                target.fillText(displayText, w.x, w.y);
                target.restore();
            }

            // Stroke pass
            if (strokeWidth > 0 && strokeOpacity > 0) {
                target.save();
                target.lineWidth = strokeWidth;
                target.lineJoin = 'round';
                target.strokeStyle = hsla(strokeHue, strokeSat, strokeLight, strokeOpacity);
                target.strokeText(displayText, w.x, w.y);
                target.restore();
            }

            // Fill pass
            target.fillStyle = hsla(hue, textSat, textLight, wordOpacity);
            // Jitter with size-aware limiting (avoid collapsing multiple words to boundary)
            const halfWScaled = (w.w * sizeScale) * 0.5;
            const halfHScaled = (w.h * sizeScale) * 0.5;
            const minXc = this.width * margin + halfWScaled;
            const maxXc = this.width * (1 - margin) - halfWScaled;
            const minYc = this.height * margin + halfHScaled;
            const maxYc = this.height * (1 - margin) - halfHScaled;
            const jxRaw = this.jitter > 0 ? (this.rng() - 0.5) * 4 * this.jitter : 0;
            const jyRaw = this.jitter > 0 ? (this.rng() - 0.5) * 4 * this.jitter : 0;
            const minDx = minXc - w.x;
            const maxDx = maxXc - w.x;
            const minDy = minYc - w.y;
            const maxDy = maxYc - w.y;
            const dx = Math.max(minDx, Math.min(maxDx, jxRaw));
            const dy = Math.max(minDy, Math.min(maxDy, jyRaw));
            const cx = w.x + dx;
            const cy = w.y + dy;
            target.fillText(displayText, cx, cy);
        }
        target.restore();
    }

    dispose(): void {
        this.layout = [];
    }

    serialize(): any {
        return {
            fontFamilyChain: this.fontFamilyChain,
            layout: this.layout,
            background: { hue: this.bgHue },
        };
    }
    deserialize(data: any): void {
        try {
            if (data?.fontFamilyChain) this.fontFamilyChain = String(data.fontFamilyChain);
            const b = data?.background || {};
            if (Number.isFinite(b.hue)) this.bgHue = ((Number(b.hue) % 360) + 360) % 360;
        } catch {}
    }

    private computeLayout(config: { width: number; height: number; words: string[] }) {
        const { width, height, words } = config;
        const safeWords = (words || []).map(w => String(w)).filter(Boolean);
        if (this.layoutMode === 'ring') return this.computeLayoutRing(width, height, safeWords);
        if (this.layoutMode === 'grid') return this.computeLayoutGrid(width, height, safeWords);
        return this.computeLayoutSpiral(width, height, safeWords);
    }

    private computeLayoutSpiral(width: number, height: number, words: string[]) {
        const layout: { text: string; x: number; y: number; size: number; hue: number; sat: number; light: number; w: number; h: number; wi: number }[] = [];
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        const area = width * height;
        const baseSize = Math.max(12, Math.sqrt(area / 1500));
        const golden = Math.PI * (3 - Math.sqrt(5));
        const radiusStep = Math.max(6, Math.min(width, height) * 0.006);
        const targetCount = this.fillSpace
            ? Math.min(600, Math.max(words.length, Math.floor((width * height) / Math.max(1, baseSize * baseSize * 10))))
            : Math.min(words.length, 220);
        const pickRng = this.rng; // deterministic
        let iWord = 0;
        const intersects = (a: any, b: any) => !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
        const measure = (text: string, size: number) => {
            const ctx = this.measureCtx;
            if (!ctx) {
                const w = Math.ceil(size * 0.58 * Math.max(1, text.length));
                const h = Math.ceil(size * 1.0);
                return { w, h };
            }
            try {
                ctx.font = `${this.fontStyle} ${this.fontWeight} ${size}px ${this.fontFamilyChain}`;
                const m = ctx.measureText(text);
                const w = Math.ceil(m.width || size * 0.6 * Math.max(1, text.length));
                const h = Math.ceil(((m as any).actualBoundingBoxAscent || 0) + ((m as any).actualBoundingBoxDescent || 0)) || Math.ceil(size * 1.1);
                return { w, h };
            } catch {
                const w = Math.ceil(size * 0.58 * Math.max(1, text.length));
                const h = Math.ceil(size * 1.0);
                return { w, h };
            }
        };

        for (let placed = 0, attempts = 0; placed < targetCount && attempts < targetCount * 400; attempts++) {
            const idx = iWord < words.length ? iWord : Math.floor(pickRng() * words.length);
            const text = words.length ? words[idx % words.length] : 'WOLK';
            if (iWord < words.length) iWord++;
            let attempt = 0;
            while (attempt < 240) {
                const size = baseSize * (0.78 + pickRng() * 0.55);
                const { w, h } = measure(text, size);
                const r = (placed + attempt) * radiusStep;
                const a = (placed + attempt) * golden;
                let x = Math.floor(cx + Math.cos(a) * r - w / 2);
                let y = Math.floor(cy + Math.sin(a) * r - h / 2);
                // size-aware safe area clamp during placement
                const padX = Math.max(4, Math.floor(w * 0.1));
                const padY = Math.max(4, Math.floor(h * 0.1));
                const minX = Math.floor(this.width * 0.06) + padX;
                const maxX = Math.floor(this.width * 0.94) - (w + padX);
                const minY = Math.floor(this.height * 0.06) + padY;
                const maxY = Math.floor(this.height * 0.94) - (h + padY);
                x = Math.max(minX, Math.min(maxX, x));
                y = Math.max(minY, Math.min(maxY, y));
                if (this.gridSnap) {
                    const gs = Math.max(1, this.gridSize);
                    x = Math.round(x / gs) * gs;
                    y = Math.round(y / gs) * gs;
                }
                const hue = this.pickHueForWord(text, placed, { x, y }, { mode: 'spiral' });
                const sat = this.colorSatMin + (this.rng() * (this.colorSatMax - this.colorSatMin));
                const light = this.colorLightMin + (this.rng() * (this.colorLightMax - this.colorLightMin));
                const rect = { text, x, y, size, hue, sat, light, w, h, wi: idx };
                let collides = false;
                for (const other of layout) { if (intersects(rect, other)) { collides = true; break; } }
                if (!collides) { layout.push(rect); placed++; break; }
                attempt++;
            }
        }
        return layout;
    }

    private computeLayoutRing(width: number, height: number, words: string[]) {
        const layout: { text: string; x: number; y: number; size: number; hue: number; sat: number; light: number; w: number; h: number; wi: number }[] = [];
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        const area = width * height;
        const baseSize = Math.max(12, Math.sqrt(area / 1600));
        const bands = Math.max(1, Math.min(24, this.ringBands | 0));
        const minDim = Math.min(width, height);
        const innerR = Math.max(20, minDim * 0.10);
        const outerR = Math.max(innerR + 10, minDim * 0.48);
        const perBand = Math.max(1, Math.ceil((words.length || 60) / bands));
        const pickRng = this.rng;
        const intersects = (a: any, b: any) => !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
        const measure = (text: string, size: number) => {
            const ctx = this.measureCtx;
            if (!ctx) return { w: Math.ceil(size * 0.58 * Math.max(1, text.length)), h: Math.ceil(size * 1.0) };
            try {
                ctx.font = `${this.fontStyle} ${this.fontWeight} ${size}px ${this.fontFamilyChain}`;
                const m = ctx.measureText(text);
                const w = Math.ceil(m.width || size * 0.6 * Math.max(1, text.length));
                const h = Math.ceil(((m as any).actualBoundingBoxAscent || 0) + ((m as any).actualBoundingBoxDescent || 0)) || Math.ceil(size * 1.1);
                return { w, h };
            } catch { return { w: Math.ceil(size * 0.58 * Math.max(1, text.length)), h: Math.ceil(size * 1.0) }; }
        };

        let wIndex = 0;
        for (let b = 0; b < bands; b++) {
            const t = bands === 1 ? 0.5 : b / (bands - 1);
            const radius = innerR + t * (outerR - innerR);
            const slots = perBand;
            for (let s = 0; s < slots; s++) {
                if (wIndex >= words.length && !this.fillSpace) break;
                const text = (wIndex < words.length) ? words[wIndex++] : (words.length ? words[Math.floor(pickRng() * words.length)] : 'WOLK');
                const angleBase = (s / slots) * Math.PI * 2;
                let attempt = 0;
                while (attempt < 200) {
                    const jitterA = (attempt ? (pickRng() - 0.5) * (Math.PI / 36) : 0);
                    const a = angleBase + jitterA;
                    const size = baseSize * (0.85 + pickRng() * 0.45);
                    const { w, h } = measure(text, size);
                    let x = Math.floor(cx + Math.cos(a) * radius - w / 2);
                    let y = Math.floor(cy + Math.sin(a) * radius - h / 2);
                    if (this.gridSnap) {
                        const gs = Math.max(1, this.gridSize);
                        x = Math.round(x / gs) * gs;
                        y = Math.round(y / gs) * gs;
                    }
                    const hue = this.pickHueForWord(text, layout.length, { x, y }, { mode: 'ring', band: b });
                    const sat = this.colorSatMin + (this.rng() * (this.colorSatMax - this.colorSatMin));
                    const light = this.colorLightMin + (this.rng() * (this.colorLightMax - this.colorLightMin));
                    const rect = { text, x, y, size, hue, sat, light, w, h, wi: wIndex - 1 };
                    let collides = false;
                    for (const other of layout) { if (intersects(rect, other)) { collides = true; break; } }
                    if (!collides) { layout.push(rect); break; }
                    attempt++;
                }
            }
        }

        // Optionally try extra fill attempts between rings if fillSpace enabled
        if (this.fillSpace && words.length) {
            const extraAttempts = 1200;
            let tries = 0;
            while (tries++ < extraAttempts) {
                const text = words[Math.floor(pickRng() * words.length)];
                const angle = pickRng() * Math.PI * 2;
                const radius = innerR + pickRng() * (outerR - innerR);
                const size = baseSize * (0.75 + pickRng() * 0.5);
                const { w, h } = measure(text, size);
                let x = Math.floor(cx + Math.cos(angle) * radius - w / 2);
                let y = Math.floor(cy + Math.sin(angle) * radius - h / 2);
                if (this.gridSnap) {
                    const gs = Math.max(1, this.gridSize);
                    x = Math.round(x / gs) * gs;
                    y = Math.round(y / gs) * gs;
                }
                const hue = this.pickHueForWord(text, layout.length, { x, y }, { mode: 'ring' });
                const sat = this.colorSatMin + (this.rng() * (this.colorSatMax - this.colorSatMin));
                const light = this.colorLightMin + (this.rng() * (this.colorLightMax - this.colorLightMin));
                const rect = { text, x, y, size, hue, sat, light, w, h, wi: layout.length };
                let collides = false;
                for (const other of layout) { if (intersects(rect, other)) { collides = true; break; } }
                if (!collides) layout.push(rect);
            }
        }
        return layout;
    }

    private computeLayoutGrid(width: number, height: number, words: string[]) {
        const layout: { text: string; x: number; y: number; size: number; hue: number; sat: number; light: number; w: number; h: number; wi: number }[] = [];
        const cols = Math.max(1, this.gridColumns | 0);
        const padding = Math.max(0, this.gridCellPadding | 0);
        const area = width * height;
        const baseSize = Math.max(12, Math.sqrt(area / 1800));
        const cellW = Math.floor(width / cols);
        // Estimate a conservative row height so rows never overlap (accounts for measured glyph height and padding)
        const estMeasure = (size: number) => {
            const ctx = this.measureCtx;
            if (!ctx) return Math.ceil(size * 1.2);
            try {
                ctx.font = `${this.fontStyle} ${this.fontWeight} ${size}px ${this.fontFamilyChain}`;
                const m = ctx.measureText('Hg');
                return Math.ceil(((m as any).actualBoundingBoxAscent || size * 0.8) + ((m as any).actualBoundingBoxDescent || size * 0.3));
            } catch { return Math.ceil(size * 1.2); }
        };
        const sizeMax = baseSize * 1.2; // our grid chooses size in [0.9,1.2] * baseSize
        const hMax = estMeasure(sizeMax);
        const rowH = this.gridRowHeight > 0 ? this.gridRowHeight : Math.max(24, hMax + 2 * padding);
        // Hard cap rows to available vertical space to prevent vertical stacking beyond view
        const maxRowsByHeight = Math.max(1, Math.floor(height / rowH));
        const neededRows = Math.ceil((this.fillSpace ? Math.max(words.length, Math.floor((height / rowH) * cols)) : words.length) / cols);
        const rows = Math.max(1, Math.min(maxRowsByHeight, neededRows));
        let i = 0;
        const measure = (text: string, size: number) => {
            const ctx = this.measureCtx;
            if (!ctx) return { w: Math.ceil(size * 0.58 * Math.max(1, text.length)), h: Math.ceil(size * 1.0) };
            try {
                ctx.font = `${this.fontStyle} ${this.fontWeight} ${size}px ${this.fontFamilyChain}`;
                const m = ctx.measureText(text);
                const w = Math.ceil(m.width || size * 0.6 * Math.max(1, text.length));
                const h = Math.ceil(((m as any).actualBoundingBoxAscent || 0) + ((m as any).actualBoundingBoxDescent || 0)) || Math.ceil(size * 1.1);
                return { w, h };
            } catch { return { w: Math.ceil(size * 0.58 * Math.max(1, text.length)), h: Math.ceil(size * 1.0) }; }
        };
        for (let r = 0; r < rows; r++) {
            const yTop = r * rowH;
            const yMid = Math.min(height, yTop + rowH / 2);
            for (let c = 0; c < cols; c++) {
                if (i >= words.length && !this.fillSpace) break;
                const text = (i < words.length) ? words[i++] : (words.length ? words[(Math.floor(this.rng() * words.length))] : 'WOLK');
                const size = baseSize * (0.9 + this.rng() * 0.3);
                const { w, h } = measure(text, size);
                let xLeft = c * cellW;
                let x;
                if (this.gridJustify === 'start') x = xLeft + padding + w / 2;
                else if (this.gridJustify === 'end') x = xLeft + cellW - padding - w / 2;
                else if (this.gridJustify === 'space') {
                    const space = Math.max(0, cellW - 2 * padding - w);
                    x = xLeft + padding + (space * (c / Math.max(1, cols - 1))) + w / 2;
                } else x = xLeft + cellW / 2;
                let y = yMid;
                if (this.gridRandomOffset > 0) {
                    const jitterAmt = this.gridRandomOffset;
                    const availW = Math.max(0, cellW - w - 2 * padding);
                    const availH = Math.max(0, rowH - h - 2 * padding);
                    x += (this.rng() - 0.5) * availW * jitterAmt;
                    y += (this.rng() - 0.5) * availH * jitterAmt;
                }
                const hue = this.pickHueForWord(text, layout.length, { x, y }, { mode: 'grid', row: r, col: c });
                const sat = this.colorSatMin + (this.rng() * (this.colorSatMax - this.colorSatMin));
                const light = this.colorLightMin + (this.rng() * (this.colorLightMax - this.colorLightMin));
                layout.push({ text, x: Math.floor(x), y: Math.floor(y), size, hue, sat, light, w, h, wi: i - 1 });
            }
        }
        return layout;
    }

    private pickHueForWord(text: string, idx: number, pos: { x: number; y: number }, extra: any): number {
        // establish base palette around seed offset
        const base = (Math.floor((this.rng() * 360)) + (this.colorSeedOffset | 0)) % 360;
        const wrap = (h: number) => ((h % 360) + 360) % 360;
        let palette: number[] = [base];
        if (this.colorPalette === 'analogous') palette = [wrap(base - 30), base, wrap(base + 30)];
        else if (this.colorPalette === 'complementary') palette = [base, wrap(base + 180)];
        else if (this.colorPalette === 'triad') palette = [base, wrap(base + 120), wrap(base + 240)];
        else if (this.colorPalette === 'custom') palette = [wrap(base - 45), wrap(base + 15), wrap(base + 210), wrap(base + 280)];

        let pickIdx = 0;
        if (this.colorAssignment === 'hash') {
            let h = 2166136261 >>> 0; const s = String(text);
            for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
            pickIdx = (h >>> 0) % palette.length;
        } else if (this.colorAssignment === 'position') {
            const t = Math.atan2(pos.y - this.height / 2, pos.x - this.width / 2);
            pickIdx = Math.abs(Math.floor(((t + Math.PI) / (2 * Math.PI)) * palette.length)) % palette.length;
        } else if (this.colorAssignment === 'band' && (extra?.band != null)) {
            pickIdx = Math.abs(Number(extra.band) | 0) % palette.length;
        } else {
            pickIdx = Math.abs(idx) % palette.length;
        }
        return palette[pickIdx];
    }
}


