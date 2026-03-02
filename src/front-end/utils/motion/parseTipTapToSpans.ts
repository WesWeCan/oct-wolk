export interface StyledSpan {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    fontSize?: string;
    fontFamily?: string;
}

const markToAttrs = (marks: any[] | undefined): Omit<StyledSpan, 'text'> => {
    const attrs: Omit<StyledSpan, 'text'> = {};
    for (const mark of marks || []) {
        if (mark?.type === 'bold') attrs.bold = true;
        if (mark?.type === 'italic') attrs.italic = true;
        if (mark?.type === 'underline') attrs.underline = true;
        if (mark?.type === 'textStyle') {
            if (typeof mark.attrs?.color === 'string') attrs.color = mark.attrs.color;
            if (typeof mark.attrs?.fontSize === 'string') attrs.fontSize = mark.attrs.fontSize;
            if (typeof mark.attrs?.fontFamily === 'string') attrs.fontFamily = mark.attrs.fontFamily;
        }
    }
    return attrs;
};

const walkNode = (node: any, out: StyledSpan[]): void => {
    if (!node) return;
    if (node.type === 'text' && typeof node.text === 'string') {
        out.push({ text: node.text, ...markToAttrs(node.marks) });
        return;
    }
    if (node.type === 'paragraph' && out.length > 0) {
        out.push({ text: '\n' });
    }
    if (Array.isArray(node.content)) {
        for (const child of node.content) walkNode(child, out);
    }
};

export function parseTipTapToSpans(json: any): StyledSpan[] {
    const out: StyledSpan[] = [];
    walkNode(json, out);
    return out.filter((span) => typeof span.text === 'string' && span.text.length > 0);
}

export function extractPlainTextFromTipTap(json: any): string {
    return parseTipTapToSpans(json).map((span) => span.text).join('');
}
