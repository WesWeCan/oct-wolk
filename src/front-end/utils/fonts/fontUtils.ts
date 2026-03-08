import type { MotionStyle, WolkProjectFont } from '@/types/project_types';
import type { ExportRenderSettings } from '@/types/export_types';
import type { SystemFontFile } from '@/front-end/services/FontsService';

export interface FontDescriptor {
    family: string;
    fallbacks: string[];
    style: 'normal' | 'italic' | 'oblique';
    weight: number;
    name?: string;
    localPath?: string;
}

export interface MotionFontSelection extends FontDescriptor {
    source: 'project' | 'system';
    filePath?: string;
}

export interface GroupedSystemFont {
    family: string;
    searchText: string;
    variants: SystemFontFile[];
}

const LEGACY_PROJECT_FONT_ALIAS = 'ProjectFont';

const quoteFontFamily = (value: string): string => {
    return /[^a-zA-Z0-9_-]/.test(value)
        ? `"${value.replace(/"/g, '\\"')}"`
        : value;
};

const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
};

export const getFontAlias = (localPath?: string, family?: string): string | undefined => {
    if (!localPath) return undefined;
    const base = (family || LEGACY_PROJECT_FONT_ALIAS).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || LEGACY_PROJECT_FONT_ALIAS;
    return `${base}_${hashString(localPath)}`;
};

export const isLegacyProjectFontFamily = (family?: string): boolean => {
    return String(family || '').trim() === LEGACY_PROJECT_FONT_ALIAS;
};

export const buildFontFamilyChain = (font: Partial<FontDescriptor>): string => {
    const primary = String(font.family || 'system-ui');
    const fallbacks = Array.isArray(font.fallbacks) ? font.fallbacks.filter(Boolean) : [];
    const alias = getFontAlias(font.localPath, font.name || primary);
    const names = [
        alias,
        isLegacyProjectFontFamily(primary) ? null : primary,
        ...fallbacks,
    ].filter((value): value is string => !!value && value.trim().length > 0);

    const uniqueNames = names.filter((value, index) => names.indexOf(value) === index);
    return uniqueNames.length > 0 ? uniqueNames.map(quoteFontFamily).join(', ') : 'system-ui';
};

export const fontDescriptorFromProjectFont = (font?: Partial<WolkProjectFont>): FontDescriptor => {
    const family = String(font?.family || 'system-ui');
    const fallbacks = Array.isArray(font?.fallbacks) ? font!.fallbacks!.filter(Boolean) : [];
    return {
        family,
        fallbacks,
        style: font?.style || 'normal',
        weight: Number(font?.weight ?? 400) || 400,
        name: font?.name,
        localPath: font?.localPath,
    };
};

export const fontDescriptorFromRenderSettings = (settings: Partial<ExportRenderSettings>): FontDescriptor => {
    return {
        family: String(settings.fontFamily || 'system-ui'),
        fallbacks: Array.isArray(settings.fontFallbacks) ? settings.fontFallbacks.filter(Boolean) : [],
        style: settings.fontStyle || 'normal',
        weight: Number(settings.fontWeight ?? 400) || 400,
        name: settings.fontName,
        localPath: settings.fontLocalPath,
    };
};

export const fontDescriptorFromTimelineSettings = fontDescriptorFromRenderSettings;

export const fontDescriptorFromMotionStyle = (
    style: Partial<MotionStyle>,
    projectFont?: Partial<WolkProjectFont>,
): FontDescriptor => {
    const projectDescriptor = fontDescriptorFromProjectFont(projectFont);
    const family = String(style.fontFamily || projectDescriptor.family || 'system-ui');
    const shouldInheritProjectAsset = !style.fontLocalPath && (
        family === projectDescriptor.family ||
        isLegacyProjectFontFamily(family)
    );

    return {
        family,
        fallbacks: Array.isArray(style.fontFallbacks) && style.fontFallbacks.length > 0
            ? style.fontFallbacks.filter(Boolean)
            : projectDescriptor.fallbacks,
        style: style.fontStyle || projectDescriptor.style || 'normal',
        weight: Number(style.fontWeight ?? projectDescriptor.weight ?? 400) || 400,
        name: style.fontName || projectDescriptor.name,
        localPath: style.fontLocalPath || (shouldInheritProjectAsset ? projectDescriptor.localPath : undefined),
    };
};

export const applyFontSelectionToMotionStyle = (
    style: MotionStyle,
    selection: MotionFontSelection,
): MotionStyle => {
    return {
        ...style,
        fontFamily: selection.family,
        fontFallbacks: selection.fallbacks,
        fontStyle: selection.style,
        fontWeight: selection.weight,
        fontName: selection.name,
        fontLocalPath: selection.localPath,
    };
};

const compareVariants = (a: SystemFontFile, b: SystemFontFile): number => {
    const weightA = Number(a.guessWeight ?? 400);
    const weightB = Number(b.guessWeight ?? 400);
    if (weightA !== weightB) return weightA - weightB;
    const styleA = String(a.guessStyle || 'normal');
    const styleB = String(b.guessStyle || 'normal');
    if (styleA !== styleB) return styleA.localeCompare(styleB);
    return a.fileName.localeCompare(b.fileName);
};

export const getSystemFontVariantLabel = (font: SystemFontFile): string => {
    const pieces: string[] = [];
    const weight = Number(font.guessWeight ?? 400);
    if (weight !== 400) pieces.push(String(weight));
    const style = font.guessStyle || 'normal';
    if (style !== 'normal') pieces.push(style);
    return pieces.length > 0 ? pieces.join(' ') : 'Regular';
};

export const groupSystemFonts = (fonts: SystemFontFile[]): GroupedSystemFont[] => {
    const groups = new Map<string, SystemFontFile[]>();

    for (const font of fonts) {
        const family = String(font.familyGuess || '').trim();
        if (!family) continue;
        const list = groups.get(family) || [];
        list.push(font);
        groups.set(family, list);
    }

    return Array.from(groups.entries())
        .map(([family, variants]) => {
            const deduped = variants
                .slice()
                .sort(compareVariants)
                .filter((variant, index, list) => {
                    return list.findIndex((candidate) => (
                        candidate.familyGuess === variant.familyGuess &&
                        candidate.guessStyle === variant.guessStyle &&
                        candidate.guessWeight === variant.guessWeight &&
                        candidate.fileName.toLowerCase() === variant.fileName.toLowerCase()
                    )) === index;
                });

            const searchText = [
                family,
                ...deduped.map((variant) => `${variant.fileName} ${getSystemFontVariantLabel(variant)}`),
            ].join(' ').toLowerCase();

            return { family, searchText, variants: deduped };
        })
        .sort((a, b) => a.family.localeCompare(b.family));
};
