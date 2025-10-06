import type { SceneContext, WorkerScene } from '../engine/types';
import { getAnimated } from '../engine/params';

export class SingleWordScene implements WorkerScene {
    private words: string[] = [];
    private width = 0;
    private height = 0;
    private currentIndex = 0;
    private lastBeat = 0;
    private beatThreshold = 0.07;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private seededPick: () => number = () => 0.5;
    private bgHue: number = 210;
    // Smoothed feature values to avoid flicker
    private smLow = 0;
    private smMid = 0;
    private smHigh = 0;
    private smHue = 210;
    private smSat = 30;
    private smLight = 12;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        // Scoped RNG for initial index
        this.seededPick = context.createScopedRng('singleWord.pick');
        // Initialize smoothing state
        this.smLow = 0; this.smMid = 0; this.smHigh = 0;
        this.smHue = this.bgHue; this.smSat = 30; this.smLight = 12;
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
        const thr = Number(params.beatThreshold);
        if (Number.isFinite(thr) && thr >= 0 && thr <= 1) this.beatThreshold = thr;
    }

    update(frame: number, dt: number, context: SceneContext): void {
        const beat = Number(context.extras?.beat || 0);
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        const wordsLen = Math.max(1, this.words.length);
        if (typeof context.extras?.wordOverride === 'string' && context.extras?.wordOverride) {
            const w = String(context.extras.wordOverride).toUpperCase();
            const idx = this.words.indexOf(w);
            if (idx >= 0) this.currentIndex = idx;
        } else if (typeof context.extras?.wordIndex === 'number' && isFinite(context.extras?.wordIndex as number)) {
            const idx = (context.extras!.wordIndex as number);
            this.currentIndex = ((idx % wordsLen) + wordsLen) % wordsLen;
        } else {
            // Completely override instance field if animatable is provided
            const threshold = (animated && Number.isFinite(animated['beatThreshold']))
                ? Math.max(0, Math.min(1, Number(animated['beatThreshold'])))
                : this.beatThreshold;
            if (beat > threshold && this.lastBeat <= threshold) {
                this.currentIndex = (this.currentIndex + 1) % wordsLen;
            }
            this.lastBeat = beat;
        }
        // Smooth band-driven parameters (low-pass filter ~250ms)
        const low = (Number.isFinite(context.extras?.lowBand as any) ? Number((context.extras as any).lowBand) : 0) || 0;
        const mid = (Number.isFinite(context.extras?.midBand as any) ? Number((context.extras as any).midBand) : 0) || 0;
        const high = (Number.isFinite(context.extras?.highBand as any) ? Number((context.extras as any).highBand) : 0) || 0;
        const tau = 0.25; // seconds
        const a = 1 - Math.exp(-Math.max(0, dt) / tau);
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        this.smLow += a * (clamp01(low) - this.smLow);
        this.smMid += a * (clamp01(mid) - this.smMid);
        this.smHigh += a * (clamp01(high) - this.smHigh);
        // Target background HSL from smoothed bands (reduced amplitudes)
        const targetHue = (this.bgHue + 80 * (this.smHigh - this.smLow) + 360) % 360;
        const targetSat = Math.max(20, Math.min(65, 30 + 35 * this.smHigh));
        const targetLight = Math.max(10, Math.min(30, 12 + 12 * this.smHigh + 6 * this.smMid));
        // Shortest path hue interpolation
        const dh = ((targetHue - this.smHue + 540) % 360) - 180;
        this.smHue = (this.smHue + a * dh + 360) % 360;
        this.smSat += a * (targetSat - this.smSat);
        this.smLight += a * (targetLight - this.smLight);
    }

    render(target: OffscreenCanvasRenderingContext2D, context: SceneContext): void {
        const w = this.width;
        const h = this.height;
        const beat = Number(context.extras?.beat || 0);
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        // Helpers
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        const hsla = (hh: number, ss: number, ll: number, aa: number) => `hsla(${Math.floor((hh % 360 + 360) % 360)}, ${Math.floor(Math.max(0, Math.min(100, ss)))}%, ${Math.floor(Math.max(0, Math.min(100, ll)))}%, ${clamp01(aa)})`;
        // Background: explicit override or smoothed HSL + opacity
        const bgHue = getAnimated(animated, 'background.hue', this.smHue as number) as number;
        const bgSat = getAnimated(animated, 'background.sat', this.smSat as number) as number;
        const bgLight = getAnimated(animated, 'background.light', this.smLight as number) as number;
        const bgOpacity = Number(getAnimated(animated, 'background.opacity', 1)) || 0;
        target.fillStyle = hsla(bgHue, bgSat, bgLight, bgOpacity);
        target.fillRect(0, 0, w, h);
        // Word transforms
        const text = this.words[this.currentIndex] || 'WOLK';
        const base = Math.min(w, h) * 0.2;
        const sizePulse = 0.9 + 0.18 * beat + 0.12 * this.smLow;
        const wordScale = Math.max(0, Number(getAnimated(animated, 'word.scale', 1))) * sizePulse;
        let size = base * wordScale;
        target.textAlign = 'center';
        target.textBaseline = 'middle';
        // Offsets and nudge
        const offX = Number(getAnimated(animated, 'word.offsetX', 0)) || 0;
        let offY = Number(getAnimated(animated, 'word.offsetY', 0)) || 0;
        const nudge = Number(getAnimated(animated, 'word.nudge', 0)) || 0;
        const nudgeDisp = nudge * (0.18 * beat + 0.12 * this.smLow);
        offY += nudgeDisp;
        const rotationDeg = 0; // keep straight
        const cx = Math.floor(w / 2) + offX;
        const cy = Math.floor(h / 2) + offY;
        // Set initial font for measurement
        target.font = `${size}px ${this.fontFamilyChain}`;
        const metrics = target.measureText(text);
        const textW = Math.ceil(metrics.width || 0);
        const textH = Math.ceil(((metrics as any).actualBoundingBoxAscent || 0) + ((metrics as any).actualBoundingBoxDescent || 0)) || Math.ceil(size * 1.2);
        // Safe area: 5% margin per edge => 90% inner rect
        const aw = w * 0.45; // half inner width
        const ah = h * 0.45; // half inner height
        const halfTextW = textW / 2;
        const halfTextH = textH / 2;
        const availW = Math.max(0, aw - Math.abs(offX));
        const availH = Math.max(0, ah - Math.abs(offY));
        const fit = Math.min(
            halfTextW > 0 ? availW / halfTextW : 1,
            halfTextH > 0 ? availH / halfTextH : 1,
            1
        );
        if (fit < 1) {
            size = size * Math.max(0, fit);
            target.font = `${size}px ${this.fontFamilyChain}`;
        }

        // Colors and opacities
        const textHue = Number(getAnimated(animated, 'word.text.hue', 0)) || 0;
        const textSat = Number(getAnimated(animated, 'word.text.sat', 0)) || 0;
        const textLight = Number(getAnimated(animated, 'word.text.light', 95)) || 95;
        const wordOpacity = Math.max(0, Math.min(1, Number(getAnimated(animated, 'word.opacity', 1)) || 0));
        // Stroke
        const strokeWidth = Math.max(0, Number(getAnimated(animated, 'word.stroke.width', 0)) || 0);
        const strokeOpacity = clamp01(Number(getAnimated(animated, 'word.stroke.opacity', 0)) || 0);
        const strokeHue = Number(getAnimated(animated, 'word.stroke.hue', 0)) || 0;
        const strokeSat = Number(getAnimated(animated, 'word.stroke.sat', 0)) || 0;
        const strokeLight = Number(getAnimated(animated, 'word.stroke.light', 0)) || 0;
        // Shadow
        const shadowBlur = Math.max(0, Number(getAnimated(animated, 'word.shadow.blur', 0)) || 0);
        const shadowOpacity = clamp01(Number(getAnimated(animated, 'word.shadow.opacity', 0)) || 0);
        const shadowHue = Number(getAnimated(animated, 'word.shadow.hue', 0)) || 0;
        const shadowSat = Number(getAnimated(animated, 'word.shadow.sat', 0)) || 0;
        const shadowLight = Number(getAnimated(animated, 'word.shadow.light', 0)) || 0;
        // Glow
        const glowSize = Math.max(0, Number(getAnimated(animated, 'word.glow.size', 0)) || 0);
        const glowOpacity = clamp01(Number(getAnimated(animated, 'word.glow.opacity', 0)) || 0);
        const glowHue = Number(getAnimated(animated, 'word.glow.hue', textHue)) || textHue;
        const glowSat = Number(getAnimated(animated, 'word.glow.sat', textSat)) || textSat;
        const glowLight = Number(getAnimated(animated, 'word.glow.light', Math.max(50, textLight))) || Math.max(50, textLight);

        // Draw order: glow -> shadow -> stroke -> fill
        // Glow pass (shadow-based glow)
        if (glowSize > 0 && glowOpacity > 0) {
            target.save();
            target.shadowBlur = glowSize;
            target.shadowColor = hsla(glowHue, glowSat, glowLight, glowOpacity);
            target.fillStyle = hsla(textHue, textSat, textLight, 0);
            target.fillText(text, cx, cy);
            target.restore();
        }

        // Shadow pass
        if (shadowBlur > 0 && shadowOpacity > 0) {
            target.save();
            target.shadowBlur = shadowBlur;
            target.shadowColor = hsla(shadowHue, shadowSat, shadowLight, shadowOpacity);
            target.fillStyle = hsla(textHue, textSat, textLight, 0);
            target.fillText(text, cx, cy);
            target.restore();
        }

        // Stroke pass
        if (strokeWidth > 0 && strokeOpacity > 0) {
            target.save();
            target.lineWidth = strokeWidth;
            target.lineJoin = 'round';
            target.strokeStyle = hsla(strokeHue, strokeSat, strokeLight, strokeOpacity);
            target.strokeText(text, cx, cy);
            target.restore();
        }

        // Fill pass
        target.fillStyle = hsla(textHue, textSat, textLight, wordOpacity);
        target.fillText(text, cx, cy);
    }

    dispose(): void {
        // nothing to dispose for 2D scene
    }

    serialize(): any {
        return {
            words: this.words,
            fontFamilyChain: this.fontFamilyChain,
            beatThreshold: this.beatThreshold,
            background: { hue: this.bgHue },
        };
    }

    deserialize(data: any): void {
        try {
            if (Array.isArray(data?.words)) this.words = data.words.map((w: any) => String(w));
            if (data?.fontFamilyChain) this.fontFamilyChain = String(data.fontFamilyChain);
            if (typeof data?.beatThreshold === 'number') this.beatThreshold = Math.min(1, Math.max(0, Number(data.beatThreshold)));
            const b = data?.background || {};
            if (Number.isFinite(b.hue)) this.bgHue = Math.max(0, Math.min(360, Number(b.hue)));
        } catch {}
    }
}

