import { buildFontFamilyChain, getFontAlias } from '@/front-end/utils/fonts/fontUtils';
import type { FontDescriptor } from '@/front-end/utils/fonts/fontUtils';

const documentFontLoads = new Map<string, Promise<void>>();

const getDescriptorKey = (font: Partial<FontDescriptor>): string => {
    return JSON.stringify({
        family: font.family || 'system-ui',
        localPath: font.localPath || '',
        fallbacks: Array.isArray(font.fallbacks) ? font.fallbacks : [],
        style: font.style || 'normal',
        weight: Number(font.weight ?? 400) || 400,
        name: font.name || '',
    });
};

export const primeDocumentFont = (font: Partial<FontDescriptor>): void => {
    void ensureDocumentFont(font);
};

export const ensureDocumentFont = async (font: Partial<FontDescriptor>): Promise<string> => {
    const chain = buildFontFamilyChain({
        family: font.family || 'system-ui',
        fallbacks: font.fallbacks || [],
        localPath: font.localPath,
        name: font.name,
    });

    if (typeof document === 'undefined' || !font.localPath) return chain;
    const alias = getFontAlias(font.localPath, font.name || font.family);
    if (!alias) return chain;

    const key = getDescriptorKey(font);
    const existing = documentFontLoads.get(key);
    if (existing) {
        await existing;
        return chain;
    }

    const loadPromise = (async () => {
        try {
            const fontFace = new FontFace(alias, `url("${font.localPath}")`, {
                style: font.style || 'normal',
                weight: String(Number(font.weight ?? 400) || 400),
            });
            const loaded = await fontFace.load();
            document.fonts.add(loaded);
        } catch {
            // Keep rendering with fallback fonts if the custom font fails to load.
        }
    })();

    documentFontLoads.set(key, loadPromise);
    await loadPromise;
    return chain;
};
