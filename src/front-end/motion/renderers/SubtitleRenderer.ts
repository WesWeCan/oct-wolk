import type { MotionStyle, MotionTransform } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, ResolvedItem, RendererBounds } from '@/front-end/motion/types';
import { applyEnterExitToAlpha, applyEnterExitToTransform } from '@/front-end/utils/motion/enterExitAnimation';
import { buildFont, spansFromRichText, spansFromWordStyleMap } from '@/front-end/utils/motion/renderTipTapSpans';

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
        fontSize: Number(animatedProps['style.fontSize'] ?? base.fontSize),
        fontWeight: Number(animatedProps['style.fontWeight'] ?? base.fontWeight),
        letterSpacing: Number(animatedProps['style.letterSpacing'] ?? base.letterSpacing),
        lineHeight: Number(animatedProps['style.lineHeight'] ?? base.lineHeight),
        backgroundPadding: Number(animatedProps['style.backgroundPadding'] ?? base.backgroundPadding),
        color: (animatedProps['style.color'] as string) ?? base.color,
        backgroundColor: (animatedProps['style.backgroundColor'] as string | null) ?? base.backgroundColor,
        fontFamily: (animatedProps['style.fontFamily'] as string) ?? base.fontFamily,
        fontStyle: (animatedProps['style.fontStyle'] as MotionStyle['fontStyle']) ?? base.fontStyle,
        textCase: (animatedProps['style.textCase'] as MotionStyle['textCase']) ?? base.textCase,
        underline: (animatedProps['style.underline'] as boolean) ?? base.underline,
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

        const alpha = applyEnterExitToAlpha(
            item.enterProgress,
            item.exitProgress,
            item.enter,
            item.exit,
        ) * resolvedStyle.opacity;
        if (alpha <= 0) return;

        const enterExitTransform = applyEnterExitToTransform(
            item.enterProgress,
            item.exitProgress,
            item.enter.style,
            item.exit.style,
        );

        const { x, y } = resolveAnchorPoint(resolvedTransform, context.canvasSize.width, context.canvasSize.height);
        const fontSize = Math.max(8, resolvedStyle.fontSize);

        ctx.save();
        ctx.translate(x + enterExitTransform.translateX, y + enterExitTransform.translateY);
        ctx.rotate((resolvedTransform.rotation * Math.PI) / 180);
        ctx.scale(resolvedTransform.scale * enterExitTransform.scale, resolvedTransform.scale * enterExitTransform.scale);

        ctx.textAlign = 'left';
        ctx.textBaseline = resolvedTransform.anchorY === 'top' ? 'top' : resolvedTransform.anchorY === 'bottom' ? 'bottom' : 'middle';
        ctx.globalAlpha = alpha;
        const spanMetrics = spans.map((span) => {
            ctx.font = buildFont(resolvedStyle, span);
            return { span, width: ctx.measureText(span.text).width };
        });
        const textWidth = spanMetrics.reduce((sum, metric) => sum + metric.width, 0);
        const textHeight = Math.max(fontSize, fontSize * 1.05);
        const pad = Math.max(0, resolvedStyle.backgroundPadding);

        if (resolvedStyle.backgroundColor) {
            let bgX = -textWidth / 2 - pad;
            if (resolvedTransform.anchorX === 'left') bgX = -pad;
            if (resolvedTransform.anchorX === 'right') bgX = -textWidth - pad;

            const bgY = -textHeight / 2 - pad;
            ctx.fillStyle = resolvedStyle.backgroundColor;
            ctx.fillRect(bgX, bgY, textWidth + pad * 2, textHeight + pad * 2);
        }

        let startX = -textWidth / 2;
        if (resolvedTransform.anchorX === 'left') startX = 0;
        if (resolvedTransform.anchorX === 'right') startX = -textWidth;
        let cursorX = startX;
        for (const metric of spanMetrics) {
            ctx.font = buildFont(resolvedStyle, metric.span);
            ctx.fillStyle = metric.span.color || resolvedStyle.color;
            ctx.fillText(metric.span.text, cursorX, 0);
            if (metric.span.underline || resolvedStyle.underline) {
                ctx.strokeStyle = metric.span.color || resolvedStyle.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cursorX, textHeight * 0.35);
                ctx.lineTo(cursorX + metric.width, textHeight * 0.35);
                ctx.stroke();
            }
            cursorX += metric.width;
        }
        ctx.restore();

        this.lastBounds = {
            x: x + enterExitTransform.translateX,
            y: y + enterExitTransform.translateY,
            width: (textWidth + pad * 2) * resolvedTransform.scale * enterExitTransform.scale,
            height: (textHeight + pad * 2) * resolvedTransform.scale * enterExitTransform.scale,
            rotation: resolvedTransform.rotation,
            scale: resolvedTransform.scale * enterExitTransform.scale,
            anchorX: resolvedTransform.anchorX,
        };
    }

    getLastBounds(): RendererBounds | null {
        return this.lastBounds;
    }

    dispose(): void {
        this.lastBounds = null;
    }
}
