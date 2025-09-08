import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SystemFontFile {
    familyGuess: string;
    filePath: string;
    fileName: string;
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
    return base.replace(/[-_](Regular|Bold|Italic|Oblique|Light|Medium|Black|SemiBold|ExtraBold|Thin)$/i, '').replace(/[_-]+/g, ' ');
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
    return unique.map(filePath => ({
        filePath,
        fileName: path.basename(filePath),
        familyGuess: guessFamilyFromFileName(path.basename(filePath)),
    }));
};


