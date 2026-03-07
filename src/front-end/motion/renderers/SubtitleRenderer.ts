import type { MotionStyle, MotionTransform, TextAlign, BoundsMode, WrapMode, OverflowBehavior } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, ResolvedItem, RendererBounds } from '@/front-end/motion/types';
import { applyEnterExitToAlpha, applyEnterExitToTransform } from '@/front-end/utils/motion/enterExitAnimation';
import { buildFont, spansFromRichText, spansFromWordStyleMap } from '@/front-end/utils/motion/renderTipTapSpans';
import type { StyledSpan } from '@/front-end/utils/motion/parseTipTapToSpans';

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

const resolveReferencePoint = (
    transform: MotionTransform,
    boundsMode: BoundsMode,
    width: number,
    height: number,
    safeBounds: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number } => {
    const left = boundsMode === 'safeArea' ? safeBounds.left : 0;
    const right = boundsMode === 'safeArea' ? safeBounds.right : width;
    const top = boundsMode === 'safeArea' ? safeBounds.top : 0;
    const bottom = boundsMode === 'safeArea' ? safeBounds.bottom : height;

    let x = (left + right) / 2;
    let y = (top + bottom) / 2;

    if (transform.anchorX === 'left') x = left;
    if (transform.anchorX === 'right') x = right;
    if (transform.anchorY === 'top') y = top;
    if (transform.anchorY === 'bottom') y = bottom;

    x += transform.offsetX;
    y += transform.offsetY;

    if (boundsMode === 'safeArea') {
        x = Math.max(left, Math.min(right, x));
        y = Math.max(top, Math.min(bottom, y));
    }

    return { x, y };
};

interface LocalRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const rotateScalePoint = (x: number, y: number, rotationDeg: number, scale: number): { x: number; y: number } => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: (x * cos - y * sin) * scale,
        y: (x * sin + y * cos) * scale,
    };
};

const screenDeltaToLocal = (
    x: number,
    y: number,
    rotationDeg: number,
    scale: number,
): { x: number; y: number } => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const safeScale = Math.abs(scale) > 0.000001 ? scale : 0.000001;
    return {
        x: ((x * cos) + (y * sin)) / safeScale,
        y: ((-x * sin) + (y * cos)) / safeScale,
    };
};

const computeRectAabb = (
    rect: LocalRect,
    rotationDeg: number,
    scale: number,
    originX: number,
    originY: number,
): { x: number; y: number; width: number; height: number } => {
    const corners = [
        rotateScalePoint(rect.x, rect.y, rotationDeg, scale),
        rotateScalePoint(rect.x + rect.width, rect.y, rotationDeg, scale),
        rotateScalePoint(rect.x, rect.y + rect.height, rotationDeg, scale),
        rotateScalePoint(rect.x + rect.width, rect.y + rect.height, rotationDeg, scale),
    ];
    const xs = corners.map((corner) => originX + corner.x);
    const ys = corners.map((corner) => originY + corner.y);
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

const fitRange = (
    min: number,
    max: number,
    targetMin: number,
    targetMax: number,
): number => {
    const size = max - min;
    const targetSize = targetMax - targetMin;

    if (size >= targetSize) {
        return ((targetMin + targetMax) / 2) - ((min + max) / 2);
    }

    let delta = 0;
    if (min < targetMin) delta = targetMin - min;
    if (max + delta > targetMax) delta = targetMax - max;
    return delta;
};

function applyAnimatedStyle(base: MotionStyle, animatedProps: Record<string, any>): MotionStyle {
    return {
        ...base,
        opacity: Number(animatedProps['style.opacity'] ?? base.opacity),
        globalOpacity: Number(animatedProps['style.globalOpacity'] ?? base.globalOpacity ?? 1),
        fontSize: Number(animatedProps['style.fontSize'] ?? base.fontSize),
        fontWeight: Number(animatedProps['style.fontWeight'] ?? base.fontWeight),
        letterSpacing: Number(animatedProps['style.letterSpacing'] ?? base.letterSpacing),
        lineHeight: Number(animatedProps['style.lineHeight'] ?? base.lineHeight),
        backgroundPadding: Number(animatedProps['style.backgroundPadding'] ?? base.backgroundPadding),
        backgroundOpacity: Number(animatedProps['style.backgroundOpacity'] ?? base.backgroundOpacity ?? (base.backgroundColor ? 1 : 0)),
        backgroundBorderRadius: Number(animatedProps['style.backgroundBorderRadius'] ?? base.backgroundBorderRadius ?? 0),
        color: (animatedProps['style.color'] as string) ?? base.color,
        backgroundColor: (animatedProps['style.backgroundColor'] as string | null) ?? base.backgroundColor,
        fontFamily: (animatedProps['style.fontFamily'] as string) ?? base.fontFamily,
        fontFallbacks: base.fontFallbacks ?? [],
        fontStyle: (animatedProps['style.fontStyle'] as MotionStyle['fontStyle']) ?? base.fontStyle,
        textCase: (animatedProps['style.textCase'] as MotionStyle['textCase']) ?? base.textCase,
        fontName: base.fontName,
        fontLocalPath: base.fontLocalPath,
        underline: (animatedProps['style.underline'] as boolean) ?? base.underline,
        textAlign: (animatedProps['style.textAlign'] as TextAlign) ?? base.textAlign ?? 'center',
        writingMode: base.writingMode ?? 'horizontal',
        outlineWidth: Number(animatedProps['style.outlineWidth'] ?? base.outlineWidth ?? 0),
        outlineColor: (animatedProps['style.outlineColor'] as string) ?? base.outlineColor ?? '#000000',
        boundsMode: (base.boundsMode ?? 'safeArea') as BoundsMode,
        wrapMode: (base.wrapMode ?? 'word') as WrapMode,
        maxLines: Number(base.maxLines ?? 5),
        overflowBehavior: (base.overflowBehavior ?? 'none') as OverflowBehavior,
        safeAreaPadding: Number(animatedProps['style.safeAreaPadding'] ?? base.safeAreaPadding ?? 40),
        safeAreaOffsetX: Number(animatedProps['style.safeAreaOffsetX'] ?? base.safeAreaOffsetX ?? 0),
        safeAreaOffsetY: Number(animatedProps['style.safeAreaOffsetY'] ?? base.safeAreaOffsetY ?? 0),
    };
}

function applyAnimatedTransform(base: MotionTransform, animatedProps: Record<string, any>): MotionTransform {
    return {
        ...base,
        offsetX: Number(animatedProps['transform.offsetX'] ?? base.offsetX),
        offsetY: Number(animatedProps['transform.offsetY'] ?? base.offsetY),
        scale: Number(animatedProps['transform.scale'] ?? base.scale),
        rotation: Number(animatedProps['transform.rotation'] ?? base.rotation),
    };
}

interface SpanMetric {
    span: StyledSpan;
    width: number;
}

interface WrappedLine {
    metrics: SpanMetric[];
    width: number;
}

function trimTrailingWhitespace(metrics: SpanMetric[], width: number): WrappedLine {
    const trimmed = [...metrics];
    let nextWidth = width;
    while (trimmed.length > 0 && /^\s+$/.test(trimmed[trimmed.length - 1].span.text)) {
        nextWidth -= trimmed[trimmed.length - 1].width;
        trimmed.pop();
    }
    return { metrics: trimmed, width: Math.max(0, nextWidth) };
}

function measureSpans(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    spans: StyledSpan[],
    resolvedStyle: MotionStyle,
): SpanMetric[] {
    const ls = resolvedStyle.letterSpacing ?? 0;
    (ctx as any).letterSpacing = ls !== 0 ? `${ls}px` : '0px';
    return spans.map((span) => {
        ctx.font = buildFont(resolvedStyle, span);
        return { span, width: ctx.measureText(span.text).width };
    });
}

function wrapSpans(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    spanMetrics: SpanMetric[],
    maxWidth: number,
    resolvedStyle: MotionStyle,
    wrapMode: WrapMode,
): WrappedLine[] {
    if (wrapMode === 'none' || maxWidth <= 0) {
        const totalWidth = spanMetrics.reduce((sum, m) => sum + m.width, 0);
        return [{ metrics: spanMetrics, width: totalWidth }];
    }

    const words: { text: string; span: StyledSpan; width: number }[] = [];
    for (const m of spanMetrics) {
        const chunks = m.span.text.split(/(\s+)/);
        for (const chunk of chunks) {
            if (!chunk) continue;
            ctx.font = buildFont(resolvedStyle, m.span);
            words.push({ text: chunk, span: m.span, width: ctx.measureText(chunk).width });
        }
    }

    const lines: WrappedLine[] = [];
    let currentLine: SpanMetric[] = [];
    let currentWidth = 0;

    for (const word of words) {
        const isSpace = /^\s+$/.test(word.text);
        if (currentWidth + word.width > maxWidth && currentWidth > 0 && !isSpace) {
            const trimmed = trimTrailingWhitespace(currentLine, currentWidth);
            if (trimmed.metrics.length > 0) {
                lines.push(trimmed);
            }
            currentLine = [];
            currentWidth = 0;
        }
        if (currentLine.length === 0 && isSpace) continue;
        currentLine.push({ span: { ...word.span, text: word.text }, width: word.width });
        currentWidth += word.width;
    }
    if (currentLine.length > 0) {
        lines.push(trimTrailingWhitespace(currentLine, currentWidth));
    }

    if (wrapMode === 'balanced' && lines.length > 1) {
        const totalWidth = lines.reduce((sum, l) => sum + l.width, 0);
        const targetWidth = totalWidth / lines.length;
        const balanced: WrappedLine[] = [];
        let bLine: SpanMetric[] = [];
        let bWidth = 0;
        const allMetrics = lines.flatMap(l => l.metrics);
        for (const m of allMetrics) {
            if (bWidth + m.width > targetWidth * 1.15 && bWidth > 0 && !/^\s+$/.test(m.span.text)) {
                balanced.push({ metrics: bLine, width: bWidth });
                bLine = [];
                bWidth = 0;
            }
            bLine.push(m);
            bWidth += m.width;
        }
        if (bLine.length > 0) balanced.push({ metrics: bLine, width: bWidth });
        return balanced;
    }

    return lines;
}

function applyOverflow(
    lines: WrappedLine[],
    maxLines: number,
    overflow: OverflowBehavior,
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    resolvedStyle: MotionStyle,
): WrappedLine[] {
    if (maxLines <= 0 || lines.length <= maxLines || overflow === 'none') return lines;

    const truncated = lines.slice(0, maxLines);

    if (overflow === 'ellipsis') {
        const last = truncated[truncated.length - 1];
        const ellSpan: StyledSpan = { text: '…' };
        ctx.font = buildFont(resolvedStyle, ellSpan);
        const ellW = ctx.measureText('…').width;
        last.metrics.push({ span: ellSpan, width: ellW });
        last.width += ellW;
    }

    return truncated;
}

export class SubtitleRenderer implements MotionBlockRenderer {
    lastBounds: RendererBounds | null = null;

    prepare(): void {
        return;
    }

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void {
        this.lastBounds = null;
        if (activeItems.length === 0) return;

        const item = activeItems
            .slice()
            .sort((a, b) => a.startMs - b.startMs)
            .at(-1);
        if (!item) return;

        const resolvedStyle = applyAnimatedStyle(item.style, animatedProps);
        const resolvedTransform = applyAnimatedTransform(item.transform, animatedProps);

        const displayText = applyTextCase(item.text, resolvedStyle.textCase);
        let spans = spansFromRichText(item.richText, displayText);
        if (spans.length === 1 && !item.richText && item.wordStyleMap && Object.keys(item.wordStyleMap).length > 0) {
            spans = spansFromWordStyleMap(displayText, item.wordStyleMap);
        }
        if (!displayText && spans.length === 0) return;

        const enterExitAlpha = applyEnterExitToAlpha(
            item.enterProgress,
            item.exitProgress,
            item.enter,
            item.exit,
        );
        if (enterExitAlpha <= 0) return;
        const textOpacity = clamp01(resolvedStyle.opacity, 1);
        const globalOpacity = clamp01(resolvedStyle.globalOpacity, 1);

        const enterExitTransform = applyEnterExitToTransform(
            item.enterProgress,
            item.exitProgress,
            item.enter,
            item.exit,
        );

        const fontSize = Math.max(8, resolvedStyle.fontSize);
        const textAlign = resolvedStyle.textAlign ?? 'center';
        const outlineWidth = resolvedStyle.outlineWidth ?? 0;
        const outlineColor = resolvedStyle.outlineColor ?? '#000000';
        const boundsMode = resolvedStyle.boundsMode ?? 'safeArea';
        const wrapMode = resolvedStyle.wrapMode ?? 'word';
        const maxLines = resolvedStyle.maxLines ?? 5;
        const overflowBehavior = resolvedStyle.overflowBehavior ?? 'none';
        const safeAreaPadding = resolvedStyle.safeAreaPadding ?? 40;
        const safeAreaOffsetX = resolvedStyle.safeAreaOffsetX ?? 0;
        const safeAreaOffsetY = resolvedStyle.safeAreaOffsetY ?? 0;
        const pad = Math.max(0, resolvedStyle.backgroundPadding);

        const cw = context.canvasSize.width;
        const ch = context.canvasSize.height;

        const saLeft = safeAreaPadding + safeAreaOffsetX;
        const saRight = cw - safeAreaPadding + safeAreaOffsetX;
        const saTop = safeAreaPadding + safeAreaOffsetY;
        const saBottom = ch - safeAreaPadding + safeAreaOffsetY;
        const saWidth = saRight - saLeft;
        const saHeight = saBottom - saTop;

        // Phase 1: measure and wrap inside the constraint region.
        const spanMetrics = measureSpans(ctx, spans, resolvedStyle);
        const availableWidth = boundsMode === 'safeArea'
            ? Math.max(0, saWidth - pad * 2)
            : Infinity;

        let lines = wrapSpans(ctx, spanMetrics, availableWidth, resolvedStyle, wrapMode);

        if (wrapMode !== 'none') {
            lines = applyOverflow(lines, maxLines, overflowBehavior, ctx, resolvedStyle);
        }

        let scaleFactor = 1;
        if (overflowBehavior === 'scaleDown' && wrapMode !== 'none') {
            let reLines = wrapSpans(ctx, spanMetrics, availableWidth, resolvedStyle, wrapMode);
            let attempts = 0;
            while (reLines.length > maxLines && scaleFactor > 0.2 && attempts < 20) {
                scaleFactor *= 0.9;
                const scaledAvail = availableWidth / scaleFactor;
                reLines = wrapSpans(ctx, spanMetrics, scaledAvail, resolvedStyle, wrapMode);
                attempts++;
            }
            if (scaleFactor < 1) {
                lines = reLines.slice(0, maxLines);
            }
        }

        const lineHeightPx = Math.max(fontSize, fontSize * resolvedStyle.lineHeight);
        const totalTextHeight = lines.length * lineHeightPx;
        const maxLineWidth = Math.max(...lines.map(l => l.width), 0);
        const isJustify = textAlign === 'justify';
        const effectiveBlockWidth = isJustify && lines.length > 1 && availableWidth < Infinity
            ? Math.max(maxLineWidth, availableWidth)
            : maxLineWidth;
        const effectiveAlign = isJustify ? 'left' : textAlign;
        const boxWidth = effectiveBlockWidth + pad * 2;
        const boxHeight = totalTextHeight + pad * 2;
        const boxLeft = resolvedTransform.anchorX === 'left'
            ? 0
            : resolvedTransform.anchorX === 'right'
                ? -boxWidth
                : -(boxWidth / 2);
        const boxTop = resolvedTransform.anchorY === 'top'
            ? 0
            : resolvedTransform.anchorY === 'bottom'
                ? -boxHeight
                : -(boxHeight / 2);
        const contentLeft = boxLeft + pad;
        const contentTop = boxTop + pad;

        const referencePoint = resolveReferencePoint(
            resolvedTransform,
            boundsMode,
            cw,
            ch,
            { left: saLeft, right: saRight, top: saTop, bottom: saBottom },
        );
        const drawReferenceX = referencePoint.x + enterExitTransform.translateX;
        const drawReferenceY = referencePoint.y + enterExitTransform.translateY;
        const totalScale = resolvedTransform.scale * enterExitTransform.scale * scaleFactor;

        const baseLocalBox: LocalRect = {
            x: boxLeft,
            y: boxTop,
            width: boxWidth,
            height: boxHeight,
        };

        let containShiftScreenX = 0;
        let containShiftScreenY = 0;
        if (boundsMode === 'safeArea' && saWidth > 0 && saHeight > 0) {
            const baseAabb = computeRectAabb(baseLocalBox, resolvedTransform.rotation, totalScale, drawReferenceX, drawReferenceY);
            containShiftScreenX = fitRange(baseAabb.x, baseAabb.x + baseAabb.width, saLeft, saRight);
            containShiftScreenY = fitRange(baseAabb.y, baseAabb.y + baseAabb.height, saTop, saBottom);
        }
        const containShiftLocal = screenDeltaToLocal(
            containShiftScreenX,
            containShiftScreenY,
            resolvedTransform.rotation,
            totalScale,
        );

        const shiftedContentLeft = contentLeft + containShiftLocal.x;
        const shiftedContentTop = contentTop + containShiftLocal.y;
        const shiftedLocalBox: LocalRect = {
            x: baseLocalBox.x + containShiftLocal.x,
            y: baseLocalBox.y + containShiftLocal.y,
            width: baseLocalBox.width,
            height: baseLocalBox.height,
        };

        // Phase 2: render from the stable reference point.
        ctx.save();
        ctx.translate(drawReferenceX, drawReferenceY);
        ctx.rotate((resolvedTransform.rotation * Math.PI) / 180);
        ctx.scale(totalScale, totalScale);

        ctx.textBaseline = 'top';
        ctx.globalAlpha = enterExitAlpha * globalOpacity;

        // Background
        const bgOpacity = resolvedStyle.backgroundOpacity ?? 0;
        const bgColor = resolvedStyle.backgroundColor || '#000000';
        if (bgOpacity > 0 && bgColor) {
            const bgRadius = Math.max(0, resolvedStyle.backgroundBorderRadius ?? 0);

            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = prevAlpha * bgOpacity;
            ctx.fillStyle = bgColor;

            if (bgRadius > 0) {
                ctx.beginPath();
                (ctx as any).roundRect(
                    shiftedLocalBox.x,
                    shiftedLocalBox.y,
                    shiftedLocalBox.width,
                    shiftedLocalBox.height,
                    bgRadius,
                );
                ctx.fill();
            } else {
                ctx.fillRect(
                    shiftedLocalBox.x,
                    shiftedLocalBox.y,
                    shiftedLocalBox.width,
                    shiftedLocalBox.height,
                );
            }
            ctx.globalAlpha = prevAlpha;
        }

        // Render lines
        const baseAlpha = ctx.globalAlpha;
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            const lineY = shiftedContentTop + lineIdx * lineHeightPx;

            const isLastLine = lineIdx === lines.length - 1;
            const justifyThisLine = isJustify && !isLastLine && lines.length > 1;

            let startX: number;
            let extraWordSpacing = 0;

            if (effectiveAlign === 'left' || justifyThisLine) {
                startX = shiftedContentLeft;
                if (justifyThisLine && availableWidth < Infinity) {
                    const spaces = line.metrics.filter(m => /^\s+$/.test(m.span.text));
                    if (spaces.length > 0) {
                        extraWordSpacing = (effectiveBlockWidth - line.width) / spaces.length;
                    }
                }
            } else if (effectiveAlign === 'right') {
                startX = shiftedContentLeft + (effectiveBlockWidth - line.width);
            } else {
                startX = shiftedContentLeft + ((effectiveBlockWidth - line.width) / 2);
            }

            ctx.textAlign = 'left';
            let cursorX = startX;

            for (const metric of line.metrics) {
                ctx.font = buildFont(resolvedStyle, metric.span);

                if (outlineWidth > 0) {
                    ctx.globalAlpha = baseAlpha;
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = outlineWidth;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(metric.span.text, cursorX, lineY);
                }

                const spanColor = item.forceStyleColor ? resolvedStyle.color : (metric.span.color || resolvedStyle.color);
                if (textOpacity > 0) {
                    ctx.globalAlpha = baseAlpha * textOpacity;
                    ctx.fillStyle = spanColor;
                    ctx.fillText(metric.span.text, cursorX, lineY);
                }

                if (metric.span.underline || resolvedStyle.underline) {
                    if (textOpacity > 0) {
                        ctx.globalAlpha = baseAlpha * textOpacity;
                        ctx.strokeStyle = spanColor;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(cursorX, lineY + fontSize * 0.35);
                        ctx.lineTo(cursorX + metric.width, lineY + fontSize * 0.35);
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = baseAlpha;
                cursorX += metric.width;
                if (justifyThisLine && /^\s+$/.test(metric.span.text)) {
                    cursorX += extraWordSpacing;
                }
            }
        }

        ctx.restore();
        const finalAabb = computeRectAabb(
            shiftedLocalBox,
            resolvedTransform.rotation,
            totalScale,
            drawReferenceX,
            drawReferenceY,
        );
        this.lastBounds = {
            x: finalAabb.x,
            y: finalAabb.y,
            width: finalAabb.width,
            height: finalAabb.height,
            referenceX: drawReferenceX,
            referenceY: drawReferenceY,
            localBoxX: shiftedLocalBox.x,
            localBoxY: shiftedLocalBox.y,
            localBoxWidth: shiftedLocalBox.width,
            localBoxHeight: shiftedLocalBox.height,
            rotation: resolvedTransform.rotation,
            scale: totalScale,
        };
    }

    getLastBounds(): RendererBounds | null {
        return this.lastBounds;
    }

    dispose(): void {
        this.lastBounds = null;
    }
}
