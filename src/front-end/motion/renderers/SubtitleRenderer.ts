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

const resolveAnchorPoint = (
    transform: MotionTransform,
    width: number,
    height: number,
): { x: number; y: number } => {
    let x = width / 2;
    let y = height / 2;

    if (transform.anchorX === 'left') x = 0;
    if (transform.anchorX === 'right') x = width;
    if (transform.anchorY === 'top') y = 0;
    if (transform.anchorY === 'bottom') y = height;

    return { x: x + transform.offsetX, y: y + transform.offsetY };
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
        fontStyle: (animatedProps['style.fontStyle'] as MotionStyle['fontStyle']) ?? base.fontStyle,
        textCase: (animatedProps['style.textCase'] as MotionStyle['textCase']) ?? base.textCase,
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
            lines.push({ metrics: currentLine, width: currentWidth });
            currentLine = [];
            currentWidth = 0;
        }
        currentLine.push({ span: { ...word.span, text: word.text }, width: word.width });
        currentWidth += word.width;
    }
    if (currentLine.length > 0) {
        lines.push({ metrics: currentLine, width: currentWidth });
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
            item.enter.style,
            item.exit.style,
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

        const cw = context.canvasSize.width;
        const ch = context.canvasSize.height;

        const saLeft = safeAreaPadding + safeAreaOffsetX;
        const saRight = cw - safeAreaPadding + safeAreaOffsetX;
        const saTop = safeAreaPadding + safeAreaOffsetY;
        const saBottom = ch - safeAreaPadding + safeAreaOffsetY;
        const saWidth = saRight - saLeft;

        // --- Phase 1: Measure & wrap text (independent of canvas transform) ---
        const spanMetrics = measureSpans(ctx, spans, resolvedStyle);

        const availableWidth = boundsMode === 'safeArea'
            ? cw
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
        const pad = Math.max(0, resolvedStyle.backgroundPadding);
        const maxLineWidth = Math.max(...lines.map(l => l.width), 0);
        const isJustify = textAlign === 'justify';
        const effectiveBlockWidth = isJustify && lines.length > 1 && availableWidth < Infinity
            ? Math.max(maxLineWidth, availableWidth)
            : maxLineWidth;

        // --- Phase 2: Compute draw position & clamp within safe area ---
        let drawX: number;
        let drawY: number;

        if (boundsMode === 'safeArea') {
            if (resolvedTransform.anchorX === 'left') drawX = saLeft;
            else if (resolvedTransform.anchorX === 'right') drawX = saRight;
            else drawX = (saLeft + saRight) / 2;
            drawX += resolvedTransform.offsetX;

            if (resolvedTransform.anchorY === 'top') drawY = saTop;
            else if (resolvedTransform.anchorY === 'bottom') drawY = saBottom;
            else drawY = (saTop + saBottom) / 2;
            drawY += resolvedTransform.offsetY;

            drawX = Math.max(saLeft, Math.min(saRight, drawX));
            drawY = Math.max(saTop, Math.min(saBottom, drawY));
        } else {
            const anchor = resolveAnchorPoint(resolvedTransform, cw, ch);
            drawX = anchor.x;
            drawY = anchor.y;
        }

        // --- Phase 3: Render ---
        ctx.save();
        ctx.translate(drawX + enterExitTransform.translateX, drawY + enterExitTransform.translateY);
        ctx.rotate((resolvedTransform.rotation * Math.PI) / 180);
        ctx.scale(resolvedTransform.scale * enterExitTransform.scale, resolvedTransform.scale * enterExitTransform.scale);
        if (scaleFactor < 1) ctx.scale(scaleFactor, scaleFactor);

        ctx.textBaseline = resolvedTransform.anchorY === 'top' ? 'top' : resolvedTransform.anchorY === 'bottom' ? 'bottom' : 'middle';
        ctx.globalAlpha = enterExitAlpha * globalOpacity;

        // Background
        const bgOpacity = resolvedStyle.backgroundOpacity ?? 0;
        const bgColor = resolvedStyle.backgroundColor || '#000000';
        const effectiveAlign = isJustify ? 'left' : textAlign;
        if (bgOpacity > 0 && bgColor) {
            let bgX: number;
            if (effectiveAlign === 'left') bgX = -pad;
            else if (effectiveAlign === 'right') bgX = -effectiveBlockWidth - pad;
            else bgX = -effectiveBlockWidth / 2 - pad;

            const bgY = -totalTextHeight / 2 - pad;
            const bgW = effectiveBlockWidth + pad * 2;
            const bgH = totalTextHeight + pad * 2;
            const bgRadius = Math.max(0, resolvedStyle.backgroundBorderRadius ?? 0);

            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = prevAlpha * bgOpacity;
            ctx.fillStyle = bgColor;

            if (bgRadius > 0) {
                ctx.beginPath();
                (ctx as any).roundRect(bgX, bgY, bgW, bgH, bgRadius);
                ctx.fill();
            } else {
                ctx.fillRect(bgX, bgY, bgW, bgH);
            }
            ctx.globalAlpha = prevAlpha;
        }

        // Render lines
        const startY = -((lines.length - 1) * lineHeightPx) / 2;

        const baseAlpha = ctx.globalAlpha;
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            const lineY = startY + lineIdx * lineHeightPx;

            const isLastLine = lineIdx === lines.length - 1;
            const justifyThisLine = isJustify && !isLastLine && lines.length > 1;

            let startX: number;
            let extraWordSpacing = 0;

            if (effectiveAlign === 'left' || justifyThisLine) {
                startX = 0;
                if (justifyThisLine && availableWidth < Infinity) {
                    const spaces = line.metrics.filter(m => /^\s+$/.test(m.span.text));
                    if (spaces.length > 0) {
                        extraWordSpacing = (availableWidth - line.width) / spaces.length;
                    }
                }
            } else if (effectiveAlign === 'right') {
                startX = -line.width;
            } else {
                startX = -line.width / 2;
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

                const spanColor = metric.span.color || resolvedStyle.color;
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

        const totalScale = resolvedTransform.scale * enterExitTransform.scale * scaleFactor;
        let boundsX = drawX + enterExitTransform.translateX;
        if (effectiveAlign === 'left') boundsX -= pad * totalScale;
        else if (effectiveAlign === 'right') boundsX += pad * totalScale;

        this.lastBounds = {
            x: boundsX,
            y: drawY + enterExitTransform.translateY,
            width: (effectiveBlockWidth + pad * 2) * totalScale,
            height: (totalTextHeight + pad * 2) * totalScale,
            rotation: resolvedTransform.rotation,
            scale: totalScale,
            anchorX: effectiveAlign === 'left' ? 'left' : effectiveAlign === 'right' ? 'right' : 'center',
            anchorY: resolvedTransform.anchorY,
        };
    }

    getLastBounds(): RendererBounds | null {
        return this.lastBounds;
    }

    dispose(): void {
        this.lastBounds = null;
    }
}
