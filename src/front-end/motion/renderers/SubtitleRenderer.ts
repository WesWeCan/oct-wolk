import type { MotionStyle, MotionTransform } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, ResolvedItem } from '@/front-end/motion/types';
import { applyEnterExitToAlpha, applyEnterExitToTransform } from '@/front-end/utils/motion/enterExitAnimation';
import { buildFont, spansFromRichText } from '@/front-end/utils/motion/renderTipTapSpans';

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

export class SubtitleRenderer implements MotionBlockRenderer {
    prepare(): void {
        // No precomputation needed for simple subtitle rendering.
    }

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        activeItems: ResolvedItem[],
        context: MotionRenderContext,
    ): void {
        if (activeItems.length === 0) return;

        const item = activeItems
            .slice()
            .sort((a, b) => a.startMs - b.startMs)
            .at(-1);
        if (!item) return;

        const displayText = applyTextCase(item.text, item.style.textCase);
        const spans = spansFromRichText(item.richText, displayText);
        if (!displayText && spans.length === 0) return;

        const alpha = applyEnterExitToAlpha(
            item.enterProgress,
            item.exitProgress,
            context.block.enter.style,
            context.block.exit.style,
        ) * item.style.opacity;
        if (alpha <= 0) return;

        const enterExitTransform = applyEnterExitToTransform(
            item.enterProgress,
            item.exitProgress,
            context.block.enter.style,
            context.block.exit.style,
        );

        const { x, y } = resolveAnchorPoint(item.transform, context.canvasSize.width, context.canvasSize.height);
        const fontSize = Math.max(8, item.style.fontSize);

        ctx.save();
        ctx.translate(x + enterExitTransform.translateX, y + enterExitTransform.translateY);
        ctx.rotate((item.transform.rotation * Math.PI) / 180);
        ctx.scale(item.transform.scale * enterExitTransform.scale, item.transform.scale * enterExitTransform.scale);

        ctx.textAlign = 'left';
        ctx.textBaseline = item.transform.anchorY === 'top' ? 'top' : item.transform.anchorY === 'bottom' ? 'bottom' : 'middle';
        ctx.globalAlpha = alpha;
        const spanMetrics = spans.map((span) => {
            ctx.font = buildFont(item.style, span);
            return { span, width: ctx.measureText(span.text).width };
        });
        const textWidth = spanMetrics.reduce((sum, metric) => sum + metric.width, 0);
        const textHeight = Math.max(
            fontSize,
            fontSize * 1.05,
        );
        const pad = Math.max(0, item.style.backgroundPadding);

        if (item.style.backgroundColor) {
            let bgX = -textWidth / 2 - pad;
            if (item.transform.anchorX === 'left') bgX = -pad;
            if (item.transform.anchorX === 'right') bgX = -textWidth - pad;

            const bgY = -textHeight / 2 - pad;
            ctx.fillStyle = item.style.backgroundColor;
            ctx.fillRect(bgX, bgY, textWidth + pad * 2, textHeight + pad * 2);
        }

        let startX = -textWidth / 2;
        if (item.transform.anchorX === 'left') startX = 0;
        if (item.transform.anchorX === 'right') startX = -textWidth;
        let cursorX = startX;
        for (const metric of spanMetrics) {
            ctx.font = buildFont(item.style, metric.span);
            ctx.fillStyle = metric.span.color || item.style.color;
            ctx.fillText(metric.span.text, cursorX, 0);
            if (metric.span.underline) {
                ctx.strokeStyle = metric.span.color || item.style.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cursorX, textHeight * 0.35);
                ctx.lineTo(cursorX + metric.width, textHeight * 0.35);
                ctx.stroke();
            }
            cursorX += metric.width;
        }
        ctx.restore();
    }

    dispose(): void {}
}
