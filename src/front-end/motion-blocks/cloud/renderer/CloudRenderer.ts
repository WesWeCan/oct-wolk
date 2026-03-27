import type { MotionStyle } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, RendererBounds, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { buildFont, parseFontSize, spansFromRichText, spansFromWordStyleMap } from '@/front-end/utils/motion/renderTipTapSpans';
import type { StyledSpan } from '@/front-end/utils/motion/parseTipTapToSpans';
import { resolveSafeAreaRegion } from '@/front-end/motion-blocks/core/safeArea';
import { layoutCloudItems } from '@/front-end/motion-blocks/cloud/layout';
import type { CloudLayoutResult } from '@/front-end/motion-blocks/cloud/layout';
import { resolveCloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';
import { applyEnterExitToAlpha, applyEnterExitToTransform } from '@/front-end/utils/motion/enterExitAnimation';
import { applyTextRevealToSpans, textRevealConfigFromParams } from '@/front-end/utils/motion/textReveal';
import type { TextRevealConfig } from '@/front-end/utils/motion/textReveal';

interface SpanMetric {
    span: StyledSpan;
    width: number;
    fontSize: number;
}

interface MeasuredCloudItem {
    item: ResolvedItem;
    style: MotionStyle;
    spans: SpanMetric[];
    width: number;
    drawWidth: number;
    height: number;
    textY: number;
    pad: number;
    cursor: { x: number; span: StyledSpan } | null;
}

const clamp01 = (value: unknown, fallback = 1): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
};

const applyTextCase = (text: string, textCase: MotionStyle['textCase']): string => {
    switch (textCase) {
        case 'uppercase':
            return text.toUpperCase();
        case 'lowercase':
            return text.toLowerCase();
        case 'capitalize':
            return text.replace(/\b\w/g, (c) => c.toUpperCase());
        default:
            return text;
    }
};

const applyAnimatedStyle = (base: MotionStyle, animatedProps: Record<string, any>): MotionStyle => {
    return {
        ...base,
        opacity: Number(animatedProps['style.opacity'] ?? base.opacity),
        globalOpacity: Number(animatedProps['style.globalOpacity'] ?? base.globalOpacity ?? 1),
        fontSize: Number(animatedProps['style.fontSize'] ?? base.fontSize),
        fontWeight: Number(animatedProps['style.fontWeight'] ?? base.fontWeight),
        fontStyle: (animatedProps['style.fontStyle'] as MotionStyle['fontStyle']) ?? base.fontStyle,
        textCase: (animatedProps['style.textCase'] as MotionStyle['textCase']) ?? base.textCase,
        letterSpacing: Number(animatedProps['style.letterSpacing'] ?? base.letterSpacing),
        lineHeight: Number(animatedProps['style.lineHeight'] ?? base.lineHeight),
        color: (animatedProps['style.color'] as string) ?? base.color,
        backgroundColor: (animatedProps['style.backgroundColor'] as string | null) ?? base.backgroundColor,
        backgroundOpacity: Number(animatedProps['style.backgroundOpacity'] ?? base.backgroundOpacity ?? 0),
        backgroundPadding: Number(animatedProps['style.backgroundPadding'] ?? base.backgroundPadding ?? 0),
        backgroundBorderRadius: Number(animatedProps['style.backgroundBorderRadius'] ?? base.backgroundBorderRadius ?? 0),
        outlineWidth: Number(animatedProps['style.outlineWidth'] ?? base.outlineWidth ?? 0),
        outlineColor: (animatedProps['style.outlineColor'] as string) ?? base.outlineColor ?? '#000000',
        boundsMode: base.boundsMode ?? 'safeArea',
        safeAreaPadding: Number(animatedProps['style.safeAreaPadding'] ?? base.safeAreaPadding ?? 40),
        safeAreaOffsetX: Number(animatedProps['style.safeAreaOffsetX'] ?? base.safeAreaOffsetX ?? 0),
        safeAreaOffsetY: Number(animatedProps['style.safeAreaOffsetY'] ?? base.safeAreaOffsetY ?? 0),
    };
};


const measureSpans = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    spans: StyledSpan[],
    style: MotionStyle,
): SpanMetric[] => {
    const letterSpacing = style.letterSpacing ?? 0;
    (ctx as any).letterSpacing = letterSpacing !== 0 ? `${letterSpacing}px` : '0px';
    return spans.map((span) => {
        ctx.font = buildFont(style, span);
        return {
            span,
            width: ctx.measureText(span.text).width,
            fontSize: parseFontSize(span.fontSize, style.fontSize),
        };
    });
};

const drawRoundedRect = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) => {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const measureCloudItem = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    item: ResolvedItem,
    animatedProps: Record<string, any>,
    revealConfig: TextRevealConfig,
): MeasuredCloudItem | null => {
    const style = applyAnimatedStyle(item.style, animatedProps);
    const text = applyTextCase(item.text ?? '', style.textCase);
    if (!text.trim()) return null;

    const fullSpans = item.wordStyleMap
        ? spansFromWordStyleMap(text, item.wordStyleMap)
        : spansFromRichText(item.richText, text);
    const fullMetrics = measureSpans(ctx, fullSpans, style);

    const revealResult = applyTextRevealToSpans(
        fullSpans,
        item.textRevealEnterProgress ?? item.enterProgress,
        item.textRevealExitProgress ?? item.exitProgress,
        revealConfig,
    );
    const visibleSpans = revealResult.spans;
    const visibleMetrics = measureSpans(ctx, visibleSpans, style);

    const textWidth = fullMetrics.reduce((sum, metric) => sum + metric.width, 0);
    const visibleTextWidth = visibleMetrics.reduce((sum, metric) => sum + metric.width, 0);
    const tallestSpan = fullMetrics.reduce((max, metric) => Math.max(max, metric.fontSize), style.fontSize);
    const pad = Math.max(0, style.backgroundPadding ?? 0);
    const lineHeightPx = Math.max(tallestSpan, tallestSpan * (style.lineHeight ?? 1));
    const width = Math.max(1, textWidth + pad * 2);
    const cursorSpan = visibleMetrics.at(-1)?.span ?? fullSpans[0] ?? null;
    let cursorWidth = 0;
    if (revealResult.cursorCharIndex !== null && cursorSpan) {
        ctx.font = buildFont(style, cursorSpan);
        cursorWidth = ctx.measureText('|').width;
    }
    const drawWidth = Math.max(1, visibleTextWidth + cursorWidth + pad * 2);
    const height = Math.max(1, lineHeightPx + pad * 2);
    const textY = pad + tallestSpan + Math.max(0, (lineHeightPx - tallestSpan) / 2);

    return {
        item,
        style,
        spans: visibleMetrics,
        width,
        drawWidth,
        height,
        textY,
        pad,
        cursor: revealResult.cursorCharIndex !== null && cursorSpan
            ? { x: pad + visibleTextWidth, span: cursorSpan }
            : null,
    };
};

export class CloudRenderer implements MotionBlockRenderer {
    lastBounds: RendererBounds | null = null;
    private cachedLayout: { key: string; result: CloudLayoutResult } | null = null;

    prepare(): void {}

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        _activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void {
        this.lastBounds = null;
        const layoutParams = resolveCloudLayoutParams(context.block.params);
        const revealConfig = (item: ResolvedItem): TextRevealConfig => textRevealConfigFromParams(layoutParams, item.enter, item.exit);

        const measured = context.allItems
            .map((item) => measureCloudItem(ctx, item, animatedProps, revealConfig(item)))
            .filter((item): item is MeasuredCloudItem => item !== null);

        if (measured.length === 0) return;

        const animatedStyle = applyAnimatedStyle(context.block.style, animatedProps);
        const region = resolveSafeAreaRegion(
            animatedStyle,
            context.canvasSize.width,
            context.canvasSize.height,
        );

        const layoutKey = this.buildLayoutKey(
            measured,
            region.width,
            region.height,
            layoutParams,
            context.deterministicRandomness?.baseSeed ?? '',
            context.deterministicRandomness?.scopeKey ?? '',
        );

        if (!this.cachedLayout || this.cachedLayout.key !== layoutKey) {
            this.cachedLayout = {
                key: layoutKey,
                result: layoutCloudItems(
                    measured.map((m) => ({
                        id: m.item.id,
                        sortMs: m.item.startMs,
                        width: m.width,
                        height: m.height,
                    })),
                    context.deterministicRandomness,
                    Math.max(1, region.width),
                    Math.max(1, region.height),
                    layoutParams,
                ),
            };
        }

        const layout = this.cachedLayout.result;
        if (layout.items.length === 0) return;

        const layoutById = new Map(layout.items.map((item) => [item.id, item]));

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        for (const item of measured) {
            const placed = layoutById.get(item.item.id);
            if (!placed) continue;

            if (item.item.enterProgress <= 0 && !item.item.isActive) continue;

            const animAlpha = applyEnterExitToAlpha(
                item.item.enterProgress,
                item.item.exitProgress,
                item.item.enter,
                item.item.exit,
            );
            if (animAlpha <= 0) continue;

            const animTransform = applyEnterExitToTransform(
                item.item.enterProgress,
                item.item.exitProgress,
                item.item.enter,
                item.item.exit,
            );

            const drawX = region.left + region.width / 2 + placed.x;
            const drawY = region.top + region.height / 2 + placed.y;
            const baseAlpha = clamp01(item.style.opacity, 1) * clamp01(item.style.globalOpacity, 1) * animAlpha;
            const backgroundOpacity = clamp01(item.style.backgroundOpacity, 0);
            const textOpacity = clamp01(item.style.opacity, 1);

            ctx.save();
            ctx.translate(drawX + animTransform.translateX, drawY + animTransform.translateY);
            ctx.scale(placed.itemScale * animTransform.scale, placed.itemScale * animTransform.scale);

            if (item.style.backgroundColor && backgroundOpacity > 0 && item.spans.length > 0) {
                ctx.save();
                ctx.globalAlpha = baseAlpha * backgroundOpacity;
                ctx.fillStyle = item.style.backgroundColor;
                drawRoundedRect(
                    ctx,
                    0,
                    0,
                    item.drawWidth,
                    item.height,
                    Number(item.style.backgroundBorderRadius ?? 0),
                );
                ctx.fill();
                ctx.restore();
            }

            const outlineWidth = Number(item.style.outlineWidth ?? 0);
            let cursorX = item.pad;
            const cursorY = item.textY;
            const letterSpacing = item.style.letterSpacing ?? 0;
            (ctx as any).letterSpacing = letterSpacing !== 0 ? `${letterSpacing}px` : '0px';

            if (item.spans.length === 0 && item.cursor === null) {
                ctx.restore();
                continue;
            }

            for (const metric of item.spans) {
                ctx.font = buildFont(item.style, metric.span);
                const spanColor = metric.span.color || item.style.color;

                if (outlineWidth > 0) {
                    ctx.save();
                    ctx.globalAlpha = baseAlpha;
                    ctx.strokeStyle = item.style.outlineColor ?? '#000000';
                    ctx.lineWidth = outlineWidth;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(metric.span.text, cursorX, cursorY);
                    ctx.restore();
                }

                if (textOpacity > 0) {
                    ctx.save();
                    ctx.globalAlpha = baseAlpha * textOpacity;
                    ctx.fillStyle = spanColor;
                    ctx.fillText(metric.span.text, cursorX, cursorY);
                    ctx.restore();
                }

                if (metric.span.underline || item.style.underline) {
                    ctx.save();
                    ctx.globalAlpha = baseAlpha * textOpacity;
                    ctx.strokeStyle = spanColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cursorX, cursorY + (metric.fontSize * 0.18));
                    ctx.lineTo(cursorX + metric.width, cursorY + (metric.fontSize * 0.18));
                    ctx.stroke();
                    ctx.restore();
                }

                cursorX += metric.width;
            }

            if (item.cursor && textOpacity > 0) {
                ctx.font = buildFont(item.style, item.cursor.span);
                ctx.save();
                ctx.globalAlpha = baseAlpha * textOpacity;
                ctx.fillStyle = item.cursor.span.color || item.style.color;
                ctx.fillText('|', item.cursor.x, cursorY);
                ctx.restore();
            }

            ctx.restore();
        }

        ctx.restore();

        const referenceX = region.left + region.width / 2;
        const referenceY = region.top + region.height / 2;

        this.lastBounds = {
            x: region.left,
            y: region.top,
            width: region.width,
            height: region.height,
            referenceX,
            referenceY,
            localBoxX: -region.width / 2,
            localBoxY: -region.height / 2,
            localBoxWidth: region.width,
            localBoxHeight: region.height,
            rotation: 0,
            scale: 1,
        };
    }

    private buildLayoutKey(
        measured: MeasuredCloudItem[],
        regionWidth: number,
        regionHeight: number,
        params: { gap: number; scatter: number; sizeVariation: number },
        seed: string,
        scopeKey: string,
    ): string {
        const items = measured
            .map((m) => `${m.item.id}:${m.width.toFixed(1)}:${m.height.toFixed(1)}`)
            .join(',');
        return `${items}|${regionWidth.toFixed(0)}x${regionHeight.toFixed(0)}|${params.gap}:${params.scatter}:${params.sizeVariation}|${seed}:${scopeKey}`;
    }

    getLastBounds(): RendererBounds | null {
        return this.lastBounds;
    }

    dispose(): void {
        this.lastBounds = null;
        this.cachedLayout = null;
    }
}
