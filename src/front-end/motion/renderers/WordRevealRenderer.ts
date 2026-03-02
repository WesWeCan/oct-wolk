import type { MotionBlockRenderer, MotionRenderContext, ResolvedItem } from '@/front-end/motion/types';
import { applyEnterExitToAlpha } from '@/front-end/utils/motion/enterExitAnimation';
import { buildFont, spansFromRichText } from '@/front-end/utils/motion/renderTipTapSpans';

export class WordRevealRenderer implements MotionBlockRenderer {
    prepare(): void {}

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        _activeItems: ResolvedItem[],
        context: MotionRenderContext,
    ): void {
        const items = context.allItems.slice().sort((a, b) => a.startMs - b.startMs);
        if (items.length === 0) return;

        const accumulate = !!context.block.params?.accumulate;
        const visible = accumulate
            ? items.filter((item) => item.enterProgress > 0 && item.exitProgress < 1)
            : items.filter((item) => item.isActive || item.exitProgress < 1);
        if (visible.length === 0) return;

        const displayItems = accumulate ? visible : [visible[visible.length - 1]];
        const anchor = displayItems[displayItems.length - 1]?.transform || context.block.transform;
        let x = context.canvasSize.width / 2;
        let y = context.canvasSize.height / 2;
        if (anchor.anchorX === 'left') x = 0;
        if (anchor.anchorX === 'right') x = context.canvasSize.width;
        if (anchor.anchorY === 'top') y = 0;
        if (anchor.anchorY === 'bottom') y = context.canvasSize.height;
        x += anchor.offsetX;
        y += anchor.offsetY;

        const base = displayItems[displayItems.length - 1];
        const font = `${base.style.fontStyle} ${base.style.fontWeight} ${Math.max(8, base.style.fontSize)}px ${base.style.fontFamily}`;
        const lineHeight = Math.max(1.05, base.style.lineHeight || 1.2) * base.style.fontSize;
        const yStart = y - ((displayItems.length - 1) * lineHeight) / 2;

        ctx.save();
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        displayItems.forEach((item, index) => {
            const alpha = applyEnterExitToAlpha(
                item.enterProgress,
                item.exitProgress,
                context.block.enter.style,
                context.block.exit.style,
            ) * item.style.opacity;
            if (alpha <= 0) return;
            ctx.globalAlpha = alpha;
            const spans = spansFromRichText(item.richText, item.text);
            const spanMetrics = spans.map((span) => {
                ctx.font = buildFont(item.style, span);
                return { span, width: ctx.measureText(span.text).width };
            });
            const totalWidth = spanMetrics.reduce((sum, metric) => sum + metric.width, 0);
            let cursorX = x - totalWidth / 2;
            if (anchor.anchorX === 'left') cursorX = x;
            if (anchor.anchorX === 'right') cursorX = x - totalWidth;
            for (const metric of spanMetrics) {
                ctx.font = buildFont(item.style, metric.span);
                ctx.fillStyle = metric.span.color || item.style.color;
                ctx.fillText(metric.span.text, cursorX, yStart + index * lineHeight);
                cursorX += metric.width;
            }
        });
        ctx.restore();
    }

    dispose(): void {}
}
