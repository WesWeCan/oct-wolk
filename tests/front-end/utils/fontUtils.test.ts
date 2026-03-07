import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION_STYLE, DEFAULT_PROJECT_FONT } from '@/types/project_types';
import {
    applyFontSelectionToMotionStyle,
    buildFontFamilyChain,
    fontDescriptorFromMotionStyle,
    getFontAlias,
    groupSystemFonts,
    type MotionFontSelection,
} from '@/front-end/utils/fonts/fontUtils';

describe('fontUtils', () => {
    it('builds a stable alias-backed chain for custom fonts', () => {
        const alias = getFontAlias('wolk://song/fonts/verdana-bold.ttf', 'Verdana Bold');
        expect(buildFontFamilyChain({
            family: 'Verdana',
            fallbacks: ['sans-serif'],
            localPath: 'wolk://song/fonts/verdana-bold.ttf',
            name: 'Verdana Bold',
        })).toBe(`${alias}, Verdana, sans-serif`);
    });

    it('inherits project font metadata for legacy motion styles', () => {
        const descriptor = fontDescriptorFromMotionStyle(
            { ...DEFAULT_MOTION_STYLE, fontFamily: 'ProjectFont' },
            {
                ...DEFAULT_PROJECT_FONT,
                family: 'Verdana',
                name: 'Verdana Regular',
                localPath: 'wolk://song/fonts/verdana.ttf',
                fallbacks: ['sans-serif'],
            },
        );

        expect(descriptor.family).toBe('ProjectFont');
        expect(descriptor.localPath).toBe('wolk://song/fonts/verdana.ttf');
        expect(descriptor.fallbacks).toEqual(['sans-serif']);
        expect(descriptor.name).toBe('Verdana Regular');
    });

    it('applies a motion font selection without dropping metadata', () => {
        const selection: MotionFontSelection = {
            source: 'system',
            family: 'Verdana',
            fallbacks: ['sans-serif'],
            style: 'italic',
            weight: 700,
            name: 'Verdana Bold Italic',
            localPath: 'wolk://song/fonts/verdana-bold-italic.ttf',
        };

        const style = applyFontSelectionToMotionStyle({ ...DEFAULT_MOTION_STYLE }, selection);
        expect(style.fontFamily).toBe('Verdana');
        expect(style.fontFallbacks).toEqual(['sans-serif']);
        expect(style.fontStyle).toBe('italic');
        expect(style.fontWeight).toBe(700);
        expect(style.fontName).toBe('Verdana Bold Italic');
        expect(style.fontLocalPath).toBe('wolk://song/fonts/verdana-bold-italic.ttf');
    });

    it('groups duplicate system families into one searchable entry', () => {
        const grouped = groupSystemFonts([
            { familyGuess: 'Verdana', filePath: '/fonts/verdana.ttf', fileName: 'Verdana.ttf', guessStyle: 'normal', guessWeight: 400 },
            { familyGuess: 'Verdana', filePath: '/fonts/verdana-bold.ttf', fileName: 'Verdana-Bold.ttf', guessStyle: 'normal', guessWeight: 700 },
            { familyGuess: 'Verdana', filePath: '/fonts/verdana-italic.ttf', fileName: 'Verdana-Italic.ttf', guessStyle: 'italic', guessWeight: 400 },
            { familyGuess: 'Arial', filePath: '/fonts/arial.ttf', fileName: 'Arial.ttf', guessStyle: 'normal', guessWeight: 400 },
        ]);

        expect(grouped).toHaveLength(2);
        expect(grouped[1].family).toBe('Verdana');
        expect(grouped[1].variants).toHaveLength(3);
    });
});
