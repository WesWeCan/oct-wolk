import type { StyledSpan } from '@/front-end/utils/motion/parseTipTapToSpans';
import { parseTipTapToSpans } from '@/front-end/utils/motion/parseTipTapToSpans';
import type { MotionStyle } from '@/types/project_types';

export const parseFontSize = (fontSize: string | undefined, fallback: number): number => {
    if (!fontSize) return fallback;
    const parsed = Number.parseFloat(fontSize);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildFont = (style: MotionStyle, span: StyledSpan): string => {
    const size = parseFontSize(span.fontSize, style.fontSize);
    const fontStyle = span.italic ? 'italic' : style.fontStyle;
    const weight = span.bold ? 700 : style.fontWeight;
    const family = span.fontFamily || style.fontFamily;
    return `${fontStyle} ${weight} ${Math.max(8, size)}px ${family}`;
};

export const spansFromRichText = (richText: any, fallbackText: string): StyledSpan[] => {
    if (richText && typeof richText === 'object') {
        const parsed = parseTipTapToSpans(richText);
        if (parsed.length > 0) return parsed;
    }
    return [{ text: fallbackText }];
};
