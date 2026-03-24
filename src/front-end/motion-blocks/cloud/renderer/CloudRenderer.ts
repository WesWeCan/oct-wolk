import type { MotionStyle, MotionTransform } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, RendererBounds, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { buildFont, parseFontSize, spansFromRichText, spansFromWordStyleMap } from '@/front-end/utils/motion/renderTipTapSpans';
import type { StyledSpan } from '@/front-end/utils/motion/parseTipTapToSpans';
import { resolveReferencePointInRegion, resolveSafeAreaRegion } from '@/front-end/motion-blocks/core/safeArea';
import { layoutCloudItems } from '@/front-end/motion-blocks/cloud/layout';
import { resolveCloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';

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
    height: number;
    textY: number;
    pad: number;
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

const applyAnimatedTransform = (base: MotionTransform, animatedProps: Record<string, any>): MotionTransform => {
    return {
        ...base,
        offsetX: Number(animatedProps['transform.offsetX'] ?? base.offsetX),
        offsetY: Number(animatedProps['transform.offsetY'] ?? base.offsetY),
        scale: Number(animatedProps['transform.scale'] ?? base.scale),
        rotation: Number(animatedProps['transform.rotation'] ?? base.rotation),
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

const rotateScalePoint = (x: number, y: number, rotationDeg: number, scale: number) => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: (x * cos - y * sin) * scale,
        y: (x * sin + y * cos) * scale,
    };
};

const computeRectAabb = (
    localBoxX: number,
    localBoxY: number,
    localBoxWidth: number,
    localBoxHeight: number,
    rotationDeg: number,
    scale: number,
    referenceX: number,
    referenceY: number,
) => {
    const corners = [
        rotateScalePoint(localBoxX, localBoxY, rotationDeg, scale),
        rotateScalePoint(localBoxX + localBoxWidth, localBoxY, rotationDeg, scale),
        rotateScalePoint(localBoxX, localBoxY + localBoxHeight, rotationDeg, scale),
        rotateScalePoint(localBoxX + localBoxWidth, localBoxY + localBoxHeight, rotationDeg, scale),
    ];
    const xs = corners.map((corner) => referenceX + corner.x);
    const ys = corners.map((corner) => referenceY + corner.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
};

const measureCloudItem = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    item: ResolvedItem,
    animatedProps: Record<string, any>,
): MeasuredCloudItem | null => {
    const style = applyAnimatedStyle(item.style, animatedProps);
    const text = applyTextCase(item.text ?? '', style.textCase);
    if (!text.trim()) return null;

    const spans = item.wordStyleMap
        ? spansFromWordStyleMap(text, item.wordStyleMap)
        : spansFromRichText(item.richText, text);
    const metrics = measureSpans(ctx, spans, style);
    const textWidth = metrics.reduce((sum, metric) => sum + metric.width, 0);
    const tallestSpan = metrics.reduce((max, metric) => Math.max(max, metric.fontSize), style.fontSize);
    const pad = Math.max(0, style.backgroundPadding ?? 0);
    const lineHeightPx = Math.max(tallestSpan, tallestSpan * (style.lineHeight ?? 1));
    const width = Math.max(1, textWidth + pad * 2);
    const height = Math.max(1, lineHeightPx + pad * 2);
    const textY = pad + tallestSpan + Math.max(0, (lineHeightPx - tallestSpan) / 2);

    return {
        item,
        style,
        spans: metrics,
        width,
        height,
        textY,
        pad,
    };
};

export class CloudRenderer implements MotionBlockRenderer {
    lastBounds: RendererBounds | null = null;

    prepare(): void {}

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        _activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void {
        this.lastBounds = null;

        const transform = applyAnimatedTransform(context.block.transform, animatedProps);
        const measured = context.allItems
            .map((item) => measureCloudItem(ctx, item, animatedProps))
            .filter((item): item is MeasuredCloudItem => item !== null);

        if (measured.length === 0) return;

        const region = resolveSafeAreaRegion(
            applyAnimatedStyle(context.block.style, animatedProps),
            context.canvasSize.width,
            context.canvasSize.height,
        );
        const layoutParams = resolveCloudLayoutParams(context.block.params);
        const layout = layoutCloudItems(
            measured.map((item) => ({
                id: item.item.id,
                sortMs: item.item.startMs,
                width: item.width,
                height: item.height,
            })),
            context.deterministicRandomness,
            Math.max(1, region.width),
            Math.max(1, region.height),
            layoutParams,
        );
        if (layout.items.length === 0) return;

        const layoutById = new Map(layout.items.map((item) => [item.id, item]));
        const bounds = layout.bounds;
        const anchorLocalX = transform.anchorX === 'left'
            ? bounds.minX
            : transform.anchorX === 'right'
                ? bounds.maxX
                : (bounds.minX + bounds.maxX) / 2;
        const anchorLocalY = transform.anchorY === 'top'
            ? bounds.minY
            : transform.anchorY === 'bottom'
                ? bounds.maxY
                : (bounds.minY + bounds.maxY) / 2;
        const localBoxX = bounds.minX - anchorLocalX;
        const localBoxY = bounds.minY - anchorLocalY;
        const localBoxWidth = bounds.width;
        const localBoxHeight = bounds.height;
        const basePoint = resolveReferencePointInRegion(transform.anchorX, transform.anchorY, region);
        const referenceX = basePoint.x + transform.offsetX;
        const referenceY = basePoint.y + transform.offsetY;

        ctx.save();
        ctx.translate(referenceX, referenceY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.scale(transform.scale, transform.scale);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        for (const item of measured) {
            const placed = layoutById.get(item.item.id);
            if (!placed) continue;

            const drawX = placed.x - anchorLocalX;
            const drawY = placed.y - anchorLocalY;
            const baseAlpha = clamp01(item.style.opacity, 1) * clamp01(item.style.globalOpacity, 1);
            const backgroundOpacity = clamp01(item.style.backgroundOpacity, 0);
            const textOpacity = clamp01(item.style.opacity, 1);

            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.scale(layout.contentScale, layout.contentScale);

            if (item.style.backgroundColor && backgroundOpacity > 0) {
                ctx.save();
                ctx.globalAlpha = baseAlpha * backgroundOpacity;
                ctx.fillStyle = item.style.backgroundColor;
                drawRoundedRect(
                    ctx,
                    0,
                    0,
                    item.width,
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

            ctx.restore();
        }

        ctx.restore();

        const finalAabb = computeRectAabb(
            localBoxX,
            localBoxY,
            localBoxWidth,
            localBoxHeight,
            transform.rotation,
            transform.scale,
            referenceX,
            referenceY,
        );

        this.lastBounds = {
            x: finalAabb.x,
            y: finalAabb.y,
            width: finalAabb.width,
            height: finalAabb.height,
            referenceX,
            referenceY,
            localBoxX,
            localBoxY,
            localBoxWidth,
            localBoxHeight,
            rotation: transform.rotation,
            scale: transform.scale,
        };
    }

    getLastBounds(): RendererBounds | null {
        return this.lastBounds;
    }

    dispose(): void {
        this.lastBounds = null;
    }
}
