import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SystemFontFile {
    familyGuess: string;
    filePath: string;
    fileName: string;
    guessStyle?: 'normal' | 'italic' | 'oblique';
    guessWeight?: number;
}

const macFontDirs = [
    '/System/Library/Fonts',
    '/Library/Fonts',
    path.join(os.homedir(), 'Library', 'Fonts'),
];

const winFontDirs = [
    'C:/Windows/Fonts',
];

const linuxFontDirs = [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    path.join(os.homedir(), '.fonts'),
];

const validExtensions = new Set(['.ttf', '.otf', '.ttc']);

const safeListDir = (dir: string): string[] => {
    try {
        if (!fs.existsSync(dir)) return [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...safeListDir(full));
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (validExtensions.has(ext)) files.push(full);
            }
        }
        return files;
    } catch {
        return [];
    }
};

const guessFamilyFromFileName = (fileName: string): string => {
    const base = path.basename(fileName, path.extname(fileName));
    // Normalize: split camelCase boundaries and replace underscores/dashes with spaces
    const normalized = base
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();

    // Style/weight tokens commonly present at the end of font file names
    const STYLE_TOKENS = [
        'Regular', 'Bold', 'Italic', 'Oblique', 'Light', 'Medium', 'Black',
        'SemiBold', 'ExtraBold', 'Thin', 'ExtraLight', 'Demi', 'DemiBold',
        'Heavy', 'Ultra', 'Book', 'Roman', 'Narrow', 'Condensed', 'Expanded',
        'Compressed', 'Display', 'BoldItalic', 'ItalicBold', 'BoldOblique', 'ObliqueBold'
    ];

    let family = normalized;
    let changed = true;
    while (changed) {
        changed = false;
        for (const tok of STYLE_TOKENS) {
            // Strip token when separated by space
            const spaced = new RegExp(`(?:\\s+${tok})$`, 'i');
            if (spaced.test(family)) {
                family = family.replace(spaced, '').trim();
                changed = true;
                break;
            }
            // Also strip fused token without space at the end (e.g., BoldItalic)
            const fused = new RegExp(`${tok}$`, 'i');
            if (fused.test(family)) {
                family = family.replace(fused, '').trim();
                changed = true;
                break;
            }
        }
    }

    return family.replace(/\s{2,}/g, ' ');
};

const guessStyleWeightFromFileName = (fileName: string): { style: 'normal' | 'italic' | 'oblique'; weight: number } => {
    const base = path.basename(fileName, path.extname(fileName));
    const s = base.toLowerCase();
    let style: 'normal' | 'italic' | 'oblique' = 'normal';
    if (/italic/.test(s)) style = 'italic';
    else if (/oblique/.test(s)) style = 'oblique';
    let weight = 400;
    // Map tokens to CSS numeric weights
    if (/thin/.test(s)) weight = 100;
    else if (/extralight|ultralight/.test(s)) weight = 200;
    else if (/light/.test(s)) weight = 300;
    else if (/regular|book|roman/.test(s)) weight = 400;
    else if (/medium/.test(s)) weight = 500;
    else if (/semibold|demi|demibold/.test(s)) weight = 600;
    else if (/bold/.test(s)) weight = 700;
    else if (/extrabold|ultrabold|heavy/.test(s)) weight = 800;
    else if (/black/.test(s)) weight = 900;
    return { style, weight };
};

export const listSystemFonts = (): SystemFontFile[] => {
    let dirs: string[] = [];
    switch (process.platform) {
        case 'darwin':
            dirs = macFontDirs; break;
        case 'win32':
            dirs = winFontDirs; break;
        default:
            dirs = linuxFontDirs; break;
    }
    const files = dirs.flatMap(d => safeListDir(d));
    const unique = Array.from(new Set(files));
    return unique.map(filePath => {
        const fileName = path.basename(filePath);
        const familyGuess = guessFamilyFromFileName(fileName);
        const gw = guessStyleWeightFromFileName(fileName);
        return { filePath, fileName, familyGuess, guessStyle: gw.style, guessWeight: gw.weight };
    });
};


