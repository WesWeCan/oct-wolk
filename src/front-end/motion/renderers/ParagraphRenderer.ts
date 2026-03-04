import type { MotionBlockRenderer, MotionRenderContext, ResolvedItem } from '@/front-end/motion/types';
import { applyEnterExitToAlpha } from '@/front-end/utils/motion/enterExitAnimation';
import { buildFont, spansFromRichText } from '@/front-end/utils/motion/renderTipTapSpans';

type LayoutWord = {
    item: ResolvedItem;
    text: string;
    x: number;
    y: number;
    color?: string;
    font: string;
};

export class ParagraphRenderer implements MotionBlockRenderer {
    prepare(): void {
        return;
    }

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        _activeItems: ResolvedItem[],
        context: MotionRenderContext,
        _animatedProps: Record<string, any>,
    ): void {
        void _animatedProps;
        const items = context.allItems.slice().sort((a, b) => a.startMs - b.startMs);
        if (items.length === 0) return;

        const base = items[items.length - 1];
        const fontSize = Math.max(8, base.style.fontSize);
        const lineHeightPx = Math.max(1.05, base.style.lineHeight || 1.2) * fontSize;
        const maxWidth = Math.max(200, Math.floor(context.canvasSize.width * 0.7));
        const font = `${base.style.fontStyle} ${base.style.fontWeight} ${fontSize}px ${base.style.fontFamily}`;

        let anchorX = context.canvasSize.width / 2;
        let anchorY = context.canvasSize.height / 2;
        if (base.transform.anchorX === 'left') anchorX = 0;
        if (base.transform.anchorX === 'right') anchorX = context.canvasSize.width;
        if (base.transform.anchorY === 'top') anchorY = 0;
        if (base.transform.anchorY === 'bottom') anchorY = context.canvasSize.height;
        anchorX += base.transform.offsetX;
        anchorY += base.transform.offsetY;

        ctx.save();
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const words: LayoutWord[] = [];
        let cursorX = 0;
        let cursorY = 0;
        for (const item of items) {
            const spans = spansFromRichText(item.richText, item.text);
            for (const span of spans) {
                const chunks = span.text.split(/\s+/).filter(Boolean);
                for (const chunk of chunks) {
                    const token = `${chunk} `;
                    const richFont = buildFont(item.style, span);
                    ctx.font = richFont;
                    const width = ctx.measureText(token).width;
                    if (cursorX + width > maxWidth && cursorX > 0) {
                        cursorX = 0;
                        cursorY += lineHeightPx;
                    }
                    words.push({
                        item,
                        text: chunk,
                        x: cursorX,
                        y: cursorY,
                        color: span.color,
                        font: richFont,
                    });
                    cursorX += width;
                }
            }
        }

        const paragraphHeight = (Math.max(0, cursorY / lineHeightPx) + 1) * lineHeightPx;
        const originX = anchorX - maxWidth / 2;
        const originY = anchorY - paragraphHeight / 2 + lineHeightPx / 2;

        for (const word of words) {
            const alpha = applyEnterExitToAlpha(
                word.item.enterProgress,
                word.item.exitProgress,
                word.item.enter,
                word.item.exit,
            ) * word.item.style.opacity;
            if (alpha <= 0) continue;

            ctx.globalAlpha = alpha;
            ctx.font = word.font;
            ctx.fillStyle = word.color || word.item.style.color;
            ctx.fillText(word.text, originX + word.x, originY + word.y);
        }
        ctx.restore();
    }

    dispose(): void {
        return;
    }
}
